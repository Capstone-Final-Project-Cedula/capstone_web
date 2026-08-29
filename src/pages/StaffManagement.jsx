import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../api/auth';
import { toast } from 'react-toastify';
import { Users, Plus, X, Lock, ShieldOff, UserPlus, Power } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import { SkeletonTableRow } from '../components/ui/Skeleton';

const StaffManagement = () => {
  const { isAdmin } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    role: 'staff',
  });

  useEffect(() => {
    if (isAdmin) {
      fetchStaff();
    }
  }, [isAdmin]);

  const fetchStaff = async () => {
    setListLoading(true);
    try {
      const response = await authAPI.getStaff();
      setStaffList(response.data);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error(error.response?.data?.detail || 'Error loading staff');
    } finally {
      setListLoading(false);
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.register(formData);
      toast.success('Staff added successfully!');
      setShowAddForm(false);
      setFormData({ username: '', password: '', full_name: '', email: '', role: 'STAFF' });
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error adding staff');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (userId) => {
    setTogglingId(userId);
    try {
      const response = await authAPI.toggleStaffActive(userId);
      setStaffList((prev) =>
        prev.map((person) =>
          person.id === userId ? { ...person, is_active: response.data.is_active } : person
        )
      );
      toast.success(response.data.is_active ? 'Account activated' : 'Account deactivated');
    } catch (error) {
      console.error('Error toggling staff status:', error);
      toast.error(error.response?.data?.detail || 'Error updating staff status');
    } finally {
      setTogglingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <Card className="p-10 text-center max-w-lg mx-auto mt-10 animate-scale-in">
        <div className="w-16 h-16 rounded-full bg-[var(--color-error-light)] flex items-center justify-center mx-auto mb-5">
          <ShieldOff className="w-7 h-7 text-[var(--color-error)]" aria-hidden="true" />
        </div>
        <h2 className="font-display text-xl font-bold text-[var(--color-neutral-900)] mb-1.5">
          Access denied
        </h2>
        <p className="text-[var(--color-neutral-500)]">
          You need administrator privileges to access this page.
        </p>
      </Card>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-neutral-900)] flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center">
              <Users className="w-4.5 h-4.5 text-[var(--color-primary)]" aria-hidden="true" />
            </span>
            Staff Management
          </h1>
          <p className="text-[var(--color-neutral-500)] mt-2">Manage barangay personnel accounts.</p>
        </div>
        <Button
          icon={showAddForm ? X : Plus}
          variant={showAddForm ? 'secondary' : 'primary'}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Close' : 'Add Staff'}
        </Button>
      </div>

      {showAddForm && (
        <Card className="p-6 mb-6 animate-scale-in">
          <h3 className="font-display text-base font-semibold text-[var(--color-neutral-800)] mb-5">
            Add new staff
          </h3>
          <form onSubmit={handleAddStaff} noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="Username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
              <Input
                label="Password"
                type="password"
                icon={Lock}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
              <Input
                label="Full Name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1.5">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="focusable w-full h-11 px-3.5 border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] text-[15px] bg-white outline-none transition-all duration-150 focus:border-[var(--color-primary)] focus:shadow-[var(--shadow-focus)]"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-5 border-t border-[var(--color-neutral-100)]">
              <Button type="submit" loading={loading} disabled={loading} icon={UserPlus}>
                {loading ? 'Adding…' : 'Add Staff'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-100)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide">
                  Full Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-neutral-100)]">
              {listLoading ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonTableRow key={i} columns={6} />)
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-[var(--color-neutral-500)]">
                    No staff accounts found.
                  </td>
                </tr>
              ) : (
                staffList.map((person) => (
                  <tr key={person.id} className="hover:bg-[var(--color-neutral-50)] transition-colors duration-150">
                    <td className="px-6 py-4 font-medium text-[var(--color-neutral-800)]">{person.username}</td>
                    <td className="px-6 py-4 text-[var(--color-neutral-800)]">{person.full_name}</td>
                    <td className="px-6 py-4 text-[var(--color-neutral-500)]">{person.email || '—'}</td>
                    <td className="px-6 py-4">
                      <Badge tone={person.role === 'admin' ? 'error' : 'info'}>
                        {person.role?.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={person.is_active ? 'success' : 'neutral'}>
                        {person.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(person.id)}
                        disabled={togglingId === person.id}
                        className="focusable inline-flex items-center gap-1.5 text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium rounded-[var(--radius-sm)] transition-colors disabled:opacity-50"
                      >
                        <Power className="w-3.5 h-3.5" aria-hidden="true" />
                        {togglingId === person.id
                          ? 'Updating…'
                          : person.is_active
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default StaffManagement;