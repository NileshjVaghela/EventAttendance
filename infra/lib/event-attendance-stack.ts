import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as path from "path";

export class EventAttendanceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table (single-table design)
    const table = new dynamodb.Table(this, "EventTable", {
      tableName: "event-attendance",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expiresAt",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for session attendance queries
    table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
    });

    // S3 bucket for CSV uploads and QR images
    const assetsBucket = new s3.Bucket(this, "AssetsBucket", {
      bucketName: `event-attendance-assets-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    // S3 bucket for frontend hosting
    const frontendBucket = new s3.Bucket(this, "FrontendBucket", {
      bucketName: `event-attendance-frontend-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // CloudFront distribution for frontend
    const distribution = new cloudfront.Distribution(this, "FrontendCDN", {
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        { httpStatus: 404, responsePagePath: "/index.html", responseHttpStatus: 200 },
        { httpStatus: 403, responsePagePath: "/index.html", responseHttpStatus: 200 },
      ],
    });

    // Cognito User Pool for admin and desk staff
    const userPool = new cognito.UserPool(this, "AdminUserPool", {
      userPoolName: "event-attendance-admins",
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      mfa: cognito.Mfa.OFF,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      customAttributes: {
        role: new cognito.StringAttribute({ mutable: true }),
      },
    });

    const userPoolClient = new cognito.UserPoolClient(this, "AdminPoolClient", {
      userPool,
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
    });

    // Lambda execution role
    const lambdaRole = new iam.Role(this, "LambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ],
    });

    table.grantReadWriteData(lambdaRole);
    assetsBucket.grantReadWrite(lambdaRole);
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail"],
        resources: ["*"],
      })
    );
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:AdminGetUser", "cognito-idp:AdminCreateUser", "cognito-idp:AdminDeleteUser", "cognito-idp:ListUsers"],
        resources: [userPool.userPoolArn],
      })
    );

    // Shared environment variables for all lambdas
    const lambdaEnv = {
      TABLE_NAME: table.tableName,
      ASSETS_BUCKET: assetsBucket.bucketName,
      USER_POOL_ID: userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || "noreply@yourdomain.com",
      FRONTEND_URL: `https://${distribution.distributionDomainName}`,
    };

    // Lambda functions - deployed from dist/ where relative paths resolve correctly
    const functionsDistPath = path.join(__dirname, "../../src/functions/dist");

    const checkinFn = new lambda.Function(this, "CheckinFn", {
      functionName: "event-attendance-checkin",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "checkin/index.handler",
      code: lambda.Code.fromAsset(functionsDistPath),
      role: lambdaRole,
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
    });

    const sessionFn = new lambda.Function(this, "SessionFn", {
      functionName: "event-attendance-session",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "session/index.handler",
      code: lambda.Code.fromAsset(functionsDistPath),
      role: lambdaRole,
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
    });

    const adminFn = new lambda.Function(this, "AdminFn", {
      functionName: "event-attendance-admin",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "admin/index.handler",
      code: lambda.Code.fromAsset(functionsDistPath),
      role: lambdaRole,
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // API Gateway
    const api = new apigateway.RestApi(this, "EventAttendanceApi", {
      restApiName: "event-attendance-api",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization"],
      },
      deployOptions: {
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
    });

    // Cognito authorizer for admin routes
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "AdminAuthorizer", {
      cognitoUserPools: [userPool],
    });

    // Public endpoints (rate-limited, no auth)
    const captcha = api.root.addResource("captcha");
    captcha.addMethod("GET", new apigateway.LambdaIntegration(checkinFn));
    captcha.addResource("verify").addMethod("POST", new apigateway.LambdaIntegration(checkinFn));

    const checkin = api.root.addResource("checkin");
    checkin.addResource("verify-sequence").addMethod("POST", new apigateway.LambdaIntegration(checkinFn));
    checkin.addResource("verify-otp").addMethod("POST", new apigateway.LambdaIntegration(checkinFn));

    const session = api.root.addResource("session");
    session.addResource("attend").addMethod("POST", new apigateway.LambdaIntegration(sessionFn));

    // Admin endpoints (Cognito-protected)
    const admin = api.root.addResource("admin");
    const events = admin.addResource("events");
    const eventById = events.addResource("{eventId}");
    const attendees = eventById.addResource("attendees");
    const sessions = eventById.addResource("sessions");
    const sessionById = sessions.addResource("{sessionId}");
    const reports = eventById.addResource("reports");

    const adminIntegration = new apigateway.LambdaIntegration(adminFn);
    const authOpts = { authorizer, authorizationType: apigateway.AuthorizationType.COGNITO };

    events.addMethod("POST", adminIntegration, authOpts);
    events.addMethod("GET", adminIntegration, authOpts);
    eventById.addMethod("GET", adminIntegration, authOpts);
    eventById.addMethod("PUT", adminIntegration, authOpts);
    eventById.addMethod("DELETE", adminIntegration, authOpts);

    attendees.addMethod("GET", adminIntegration, authOpts);
    attendees.addResource("upload").addMethod("POST", adminIntegration, authOpts);
    attendees.addResource("search").addMethod("GET", adminIntegration, authOpts);

    sessions.addMethod("POST", adminIntegration, authOpts);
    sessions.addMethod("GET", adminIntegration, authOpts);
    sessionById.addMethod("PUT", adminIntegration, authOpts);
    sessionById.addMethod("DELETE", adminIntegration, authOpts);

    const qr = eventById.addResource("qr");
    qr.addMethod("GET", adminIntegration, authOpts);
    sessionById.addResource("qr").addMethod("GET", adminIntegration, authOpts);

    reports.addResource("checkin").addMethod("GET", adminIntegration, authOpts);
    reports.addResource("sessions").addMethod("GET", adminIntegration, authOpts);
    reports.addResource("rewards").addMethod("GET", adminIntegration, authOpts);
    reports.addResource("export").addMethod("GET", adminIntegration, authOpts);

    // Staff assignment endpoints (admin only)
    const staff = admin.addResource("staff");
    staff.addResource("assign").addMethod("POST", adminIntegration, authOpts);
    staff.addResource("unassign").addMethod("POST", adminIntegration, authOpts);
    staff.addResource("assignments").addMethod("GET", adminIntegration, authOpts);

    // Outputs
    new cdk.CfnOutput(this, "ApiUrl", { value: api.url });
    new cdk.CfnOutput(this, "FrontendUrl", { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, "UserPoolIdOutput", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientIdOutput", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "AssetsBucketOutput", { value: assetsBucket.bucketName });
  }
}
