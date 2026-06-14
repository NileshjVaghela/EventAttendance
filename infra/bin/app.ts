#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { EventAttendanceStack } from "../lib/event-attendance-stack";

const app = new cdk.App();
const env = { region: "ap-south-1" };

new EventAttendanceStack(app, "EventAttendanceStack", { env });
