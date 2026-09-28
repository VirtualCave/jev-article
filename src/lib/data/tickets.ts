export type Ticket = { id: string; text: string; department: "billing" | "technical" | "account"; urgency: number; churn: boolean };

// Labels are editorial ground truth; each row is department | urgency | churn | customer text.
const rows = `billing|3|1|I was charged twice and will cancel unless you refund the duplicate today.
billing|2|0|My invoice shows a fee that was not in the quoted price.
billing|1|0|Where can I download last month's receipt?
billing|3|1|You billed me after cancellation. Reverse it now or I will dispute it.
billing|2|1|The card on my account expired and my payment failed. We will move to another provider if the next charge fails.
billing|0|0|Can I switch from monthly billing to annual billing?
billing|2|1|The renewal price doubled. I am comparing other providers.
billing|1|1|Please explain the sales tax on this invoice. We may leave if the charge is not corrected.
billing|3|0|The invoice page shows a bug in the total, and finance needs a corrected invoice before today's audit.
billing|2|1|The refund was approved but has not reached my bank. If it does not arrive this week, we will leave.
billing|0|0|Do you accept purchase orders for enterprise plans?
billing|1|0|I need to update the billing address on future invoices.
billing|3|1|Three unexplained charges appeared this morning; I am closing this account.
billing|2|1|Our invoice lists ten seats but we only have eight. We will cancel and leave if the seats stay wrong.
billing|1|0|Please resend the receipt for the March subscription.
billing|2|1|I cannot justify another price increase and may leave next month.
billing|0|0|Which currencies can we use for payment?
billing|3|0|Payroll closes in an hour and the invoice amount must be fixed.
billing|1|0|How do I add a second payment method?
billing|2|1|The coupon did not apply to my first payment. I will switch providers if the discount is not honored.
technical|3|1|The production API has been down all morning; we will migrate if it stays down.
technical|2|1|The dashboard freezes when I upload a large CSV. We are close to leaving over this.
technical|1|0|Where is the documentation for the webhook signature?
technical|3|0|Checkout charges customers and then the callback returns 500, so they cannot log in.
technical|2|1|This integration breaks every week and we are evaluating alternatives.
technical|0|0|Is there a sandbox endpoint for testing?
technical|2|1|The mobile app crashes when I open notifications. Another crash and we will migrate.
technical|1|0|Can I export the error logs as JSON?
technical|3|1|Data has stopped syncing and our team will cancel if it is not recovered.
technical|2|1|I get a timeout while importing 20,000 records. We will leave if imports stay broken.
technical|0|0|Which browser versions are supported?
technical|1|0|How do I rotate an API token safely?
technical|3|0|The deployment broke checkout for all customers.
technical|2|1|The repeated outages are making us reconsider the contract.
technical|1|0|Search is slow today and the usage invoice looks odd, but the problem to fix is the delay.
technical|2|1|The webhook sends the same event twice. We may switch platforms because of the duplicates.
technical|0|0|Is there a status page for planned maintenance?
technical|3|1|If the missing records are not restored today, we will leave.
technical|1|0|The chart legend is clipped on a small screen.
technical|2|1|Our SSO redirect works in staging but fails in production. We will cancel if SSO stays broken.
account|3|1|My account was locked without warning; I need access today or I will leave.
account|2|1|I lost access to my two-factor device. I will close the account if I cannot get back in.
account|1|0|How do I change the email address on my profile?
account|3|0|A former employee still has admin access and can open billing details; revoke it immediately.
account|2|1|Our team cannot add members and we may switch platforms.
account|0|0|Can I invite a guest to my workspace?
account|2|1|The password reset link says it has expired. I am ready to leave if I stay locked out.
account|1|0|Where can I see my active sessions?
account|3|1|An unknown user joined our workspace. We will close it unless secured.
account|2|1|I need to transfer ownership to a colleague. If ownership cannot move, we will migrate.
account|0|0|Does the free plan allow two workspaces?
account|1|0|Please update my display name on the team page.
account|3|0|Our administrator left today and nobody can approve access.
account|2|1|Permissions keep reverting; our security team wants to leave.
account|1|0|Can I deactivate an old team member?
account|2|1|I am unable to accept an invitation from my manager. Our company will leave if invitations keep failing.
account|0|0|Where do I find the account deletion setting?
account|3|1|We have been locked out twice this week and will cancel if it recurs.
account|1|0|How can I rename my workspace?
account|2|1|The new role does not let me edit projects. We will switch tools if roles stay wrong.`;

export const tickets: Ticket[] = rows.split("\n").map((row, index) => {
  const [department, urgency, churn, text] = row.split("|");
  return { id: `ticket-${index + 1}`, text, department: department as Ticket["department"], urgency: Number(urgency), churn: churn === "1" };
});
