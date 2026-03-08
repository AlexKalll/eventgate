import { RoleNotificationsPage } from "@/components/role-notifications-page";

export default function DirectorNotificationsPage() {
  return (
    <RoleNotificationsPage
      audience="director"
      backHref="/director"
      backLabel="Back to Review Dashboard"
    />
  );
}

