import { AdminPage } from '../../features/admin/admin-page';

function publicMenuBaseUrl(): string {
  return process.env.PUBLIC_MENU_BASE_URL || process.env.WEB_URL || 'http://localhost:3000';
}

export default function AdminRoute() {
  return <AdminPage publicMenuBaseUrl={publicMenuBaseUrl()} />;
}
