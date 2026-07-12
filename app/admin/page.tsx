import AdminDashboard from './AdminDashboard';

export const metadata = {
  title: 'IDOL TRACKER - Admin Dashboard',
};

export default function AdminPage() {
  return (
    <main style={{ minHeight: '100vh', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Pending Reviews</h1>
      <AdminDashboard />
    </main>
  );
}
