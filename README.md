Here’s the **full workflow**, detailed step by step, strictly following your SRS rules and the original event form you shared, from **President submission to Director approval**:

---

## 1. President Creates Event Request

**Trigger:** President logs in and wants to create a new event.

**Steps:**

1. Checks that the club has all three roles assigned:

   * President (self)
   * Vice President
   * Secretary
   * If any role is missing → block creation
2. Fills event details:

   * Club name, title, description
   * Event date(s), start/end times
   * Location
   * External collaborators or guests (with IDs)
3. System validates:

   * Event date ≥ 7 days in future (submission window)
   * Event location and times are valid
   * Required fields filled
4. On submission:

   * Status = `Pending Internal Approval`
   * Internal approval records are created:

     * VP: Pending
     * Secretary: Pending
   * Internal approval timer starts immediately

**Outcome:**

* Event request exists in the system
* Both internal approvers can see the request in their dashboards

---

## 2. Vice President and Secretary Approvals

**Trigger:** VP and Secretary receive pending request notifications.

**Steps:**

1. System sends reminders based on deadlines (T−48h, T−24h, final notice)
2. Each approver can:

   * Approve responsibility → record decision, timestamp, lock approval
   * Reject responsibility → record decision, timestamp, lock approval
3. Internal rules:

   * Only one decision per approver
   * Approvers cannot approve if they hold another role
   * Approvals are immutable
4. Expiration:

   * If the internal approval deadline passes without action → request status = `Expired – Internal Timeout`

**Outcome:**

* Both approve → request moves to submission automatically
* Any rejection → status = `Rejected Internally`
* Deadline passed → status = `Expired – Internal Timeout`

---

## 3. Automatic Submission to Student Union

**Trigger:** Both internal approvals complete and system time < submission deadline.

**Steps:**

1. System validates submission rules:

   * Current time < event_date − 7 days
   * Internal approvals exist and approved
2. Status updates:

   * `Internally Approved → Submitted`
3. System notifies Student Union reviewers
4. Expiration check:

   * If submission occurs too late → status = `Expired – Missed Submission Window`

**Outcome:**

* Event is now officially in the external review stage
* Student Union sees event in their pending review dashboard

---

## 4. Student Union Review

**Trigger:** Union reviewer opens the submitted request.

**Steps:**

1. Reviewer checks:

   * Event details
   * Club responsibility assignments
   * Compliance with internal approvals
2. Reviewer makes decision:

   * Approve → moves request to Director for final review
   * Reject → status = `Rejected – Union`
   * Optional comments added
3. System records:

   * Reviewer identity
   * Decision timestamp
   * Immutable record

**Outcome:**

* Approved → Director step
* Rejected → workflow stops; President notified

---

## 5. Director Review

**Trigger:** Director sees event request approved by Student Union.

**Steps:**

1. Director reviews:

   * Event details
   * All prior approvals and comments
2. Decision:

   * Approve → status = `Approved`
   * Reject → status = `Rejected – Director`
3. System records:

   * Director identity
   * Timestamp
   * Immutable audit entry

**Outcome:**

* Approved → Event officially authorized
* Rejected → Event cancelled, cannot be revived
* All approvals, rejections, and expirations are logged

---

## 6. Notifications and Reminders Throughout

* Pending internal approvals → reminders sent at configured intervals
* Submission success → notification to Student Union
* Union/Director decisions → notification to President
* Expiration → notification to all involved roles

---

## 7. Statuses Through the Workflow

| Stage             | Possible Statuses                                      |
| ----------------- | ------------------------------------------------------ |
| Draft             | Draft (editable by President)                          |
| Internal Approval | Pending Internal Approval, Approved, Rejected, Expired |
| Submission        | Submitted, Expired – Missed Submission Window          |
| Union Review      | Pending Union Approval, Approved, Rejected             |
| Director Review   | Pending Director Approval, Approved, Rejected          |

---

## 8. Key Rules Embedded

1. **Time first:** Late approvals or submissions → automatic expiration
2. **Roles fixed:** Only distinct President, VP, Secretary
3. **Immutable decisions:** No changes after action
4. **Silence counts:** Not responding = failure
5. **Audit:** All decisions logged with timestamp and user

---

This flow captures **every step from the form being filled to final approval**, including reminders, expiration, and role-based restrictions.

If you want, I can draw this as a **state diagram with all transitions**, including expiration and reminder paths, which will make coding and API design trivial.

Do you want me to do that?
