# ROLE_PERMISSIONS.md

**Project:** Intent Core Alignment System  
**Purpose:** Define who may read, propose, confirm, modify, and write back information

## 1. Core rule

Permissions must be enforced by the application and Workflow Engine, not only by prompts or hidden UI controls.

Agents may analyse and propose. Authorised humans confirm decisions.

## 2. Human role permissions

| Object / action | VFX Supervisor | CG Supervisor | Artist |
|---|---|---|---|
| Read Primary Anchor | Yes | Yes | Yes |
| Create Primary Anchor draft | Yes | Suggest changes | No |
| Confirm or revise Primary Anchor | Yes | No | No |
| Read Secondary Execution Anchor | Yes | Yes | Yes, when relevant |
| Create Secondary Anchor draft | Review | Yes | No |
| Confirm or revise Secondary Anchor | No | Yes | No |
| Submit a Version | Review | Review | Yes |
| Add original Review Note | Yes | Yes | Yes, within task context |
| View Agent Assessments | Yes | Yes | Yes, role-relevant view |
| Accept or reject AI proposal | Yes, within VFX authority | Yes, within CG authority | Yes, for own draft/rationale only |
| Resolve creative-direction Human Gate | Yes | Escalate / contribute | No |
| Resolve technical-execution Human Gate | Review if creative impact | Yes | No |
| Request escalation | Yes | Yes | Yes |
| Approve creative direction change | Yes | No | No |
| Confirm production-ready state | Review where needed | Yes | No |
| Trigger approved ftrack write-back | Yes | Yes, within authority | No |
| Edit another human’s Decision | No; create a new superseding Decision | No; create a new superseding Decision | No |

## 3. Agent permissions

| Agent | May read | May create | Must not do |
|---|---|---|---|
| Core Agent | Brief, references, Anchors, versions, feedback, decisions | Intent decomposition, Primary Anchor draft, context summary, alignment Assessment, re-anchor proposal, Intent Signal input | Confirm Anchor, approve Version, resolve Human Gate, write to ftrack |
| VFX Supervisor Agent | Primary Anchor, versions, feedback, CG/Artist outputs, cross-department state | Creative review, feedback clusters, drift Assessment, review questions, re-anchor proposal | Change Primary Anchor, issue final approval, resolve gate |
| CG Supervisor Agent | Primary Anchor, Secondary Anchors, metadata, technical checks, downstream dependencies | Secondary Anchor draft, technical Assessment, production-readiness risk, escalation proposal | Change Primary Anchor, publish or approve autonomously |
| Artist Agent | Relevant Anchors, task context, feedback, references, candidate outputs | Task briefing, output comparison, submission rationale draft, escalation proposal | Modify Anchors, choose final version for Artist, confirm production-ready state |
| Cross-department capability | Shot Assembly, department Assessments, Anchors, dependencies | Conflict Assessment and escalation proposal | Replace VFX or CG decision |

## 4. System components

### Workflow Engine
May enforce permissions and valid state transitions. It may block an invalid action but cannot invent a human decision.

### Rule Engine
May produce deterministic checks. It cannot approve creative direction.

### ftrack Connector
May:

- read configured ftrack entities;
- map them to internal objects;
- receive events;
- perform explicitly authorised write-back.

It must not:

- expose credentials to Agents or the frontend;
- write raw AI output automatically;
- bypass Human Gates;
- allow an Agent to call ftrack directly.

## 5. Human Gate ownership

| Gate type | Required decision owner |
|---|---|
| Primary Anchor conflict or creative-direction change | VFX Supervisor |
| Secondary Anchor or technical execution conflict | CG Supervisor |
| Technical issue with likely creative impact | CG Supervisor, then VFX Supervisor if escalated |
| Cross-department conflict affecting overall intent | VFX Supervisor with CG input |
| Insufficient task context | CG Supervisor or VFX Supervisor, depending on source |
| Artist execution uncertainty inside current boundary | CG Supervisor |
| Request to revise Primary Anchor | VFX Supervisor |

## 6. Record integrity

- AI Proposals and Human Decisions must be stored separately.
- Confirmed Anchors must be versioned, not overwritten.
- A Decision may be superseded only by a new authorised Decision.
- Every confirmation, rejection, escalation, and write-back must record actor, timestamp, source context, and related entity.
