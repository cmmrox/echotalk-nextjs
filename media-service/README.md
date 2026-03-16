# EchoTalk Media Service

This service will host long-lived WebRTC media session state for the full end-to-end WebRTC phase.

## Purpose

- keep active peer connections alive outside short-lived route handlers
- own live media/session state
- receive inbound WebRTC tracks directly
- later handle outbound assistant audio over WebRTC

## Current status

Scaffold only. Signaling integration and direct media handling are not complete yet.

## Planned role in local dev

- run alongside Next.js dev server
- expose a local control surface for session/offer/ICE/stop operations
- keep session/peer state in one stable process
