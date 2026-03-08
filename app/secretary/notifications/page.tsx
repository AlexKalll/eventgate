import { RoleNotificationsPage } from "@/components/role-notifications-page";

export default function SecretaryNotificationsPage() {
  return (
    <RoleNotificationsPage
      audience="secretary"
      backHref="/secretary"
      backLabel="Back to Review Dashboard"
    />
  );
}

