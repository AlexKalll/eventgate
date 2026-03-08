import { RoleNotificationsPage } from "@/components/role-notifications-page";

export default function StudentUnionNotificationsPage() {
  return (
    <RoleNotificationsPage
      audience="student-union"
      backHref="/student-union"
      backLabel="Back to Review Dashboard"
    />
  );
}

