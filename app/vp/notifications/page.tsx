import { RoleNotificationsPage } from "@/components/role-notifications-page";

export default function VPNotificationsPage() {
  return (
    <RoleNotificationsPage
      audience="vp"
      backHref="/vp"
      backLabel="Back to Review Dashboard"
    />
  );
}

