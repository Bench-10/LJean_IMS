import React, { useEffect, useMemo, useState } from 'react';
import { HiOutlineMail } from 'react-icons/hi';
import { FiLock, FiSettings } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../authentication/Authentication';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Settings() {
	const { user, refreshUser } = useAuth();

	const [formValues, setFormValues] = useState({
		email: '',
		currentPassword: '',
		newPassword: '',
		confirmPassword: ''
	});

	const [initialEmail, setInitialEmail] = useState('');
	const [errors, setErrors] = useState({});
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		const currentEmail = (user?.username || user?.email || '').trim();
		setInitialEmail(currentEmail);
		setFormValues((prev) => ({
			...prev,
			email: currentEmail
		}));
	}, [user]);

	const hasChanges = useMemo(() => {
		const normalizedInitial = (initialEmail || '').trim().toLowerCase();
		const normalizedEmail = (formValues.email || '').trim().toLowerCase();
		const emailChanged = normalizedEmail !== normalizedInitial;
		const passwordChanged = Boolean(formValues.newPassword) || Boolean(formValues.confirmPassword);
		return emailChanged || passwordChanged;
	}, [formValues.email, formValues.newPassword, formValues.confirmPassword, initialEmail]);

	const handleChange = (field) => (event) => {
		const value = event.target.value;
		setFormValues((prev) => ({ ...prev, [field]: value }));
		if (errors[field]) {
			setErrors((prev) => ({ ...prev, [field]: '' }));
		}
		if (errors.general) {
			setErrors((prev) => ({ ...prev, general: '' }));
		}
	};

	const validate = () => {
		const newErrors = {};
		const trimmedEmail = (formValues.email || '').trim();
		const normalizedInitial = (initialEmail || '').trim().toLowerCase();
		const wantsEmailChange = trimmedEmail.toLowerCase() !== normalizedInitial;
		const wantsPasswordChange = Boolean(formValues.newPassword) || Boolean(formValues.confirmPassword);
		const passwordValue = formValues.newPassword || '';
		const passwordRequirements = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

		if (!wantsEmailChange && !wantsPasswordChange) {
			newErrors.general = 'No changes to save.';
			return newErrors;
		}

		if (wantsEmailChange && !EMAIL_REGEX.test(trimmedEmail)) {
			newErrors.email = 'Enter a valid email address.';
		}

		if (wantsPasswordChange) {
			if (!passwordValue) {
				newErrors.newPassword = 'Enter a new password.';
			} else if (passwordValue.trim().length < 8) {
				newErrors.newPassword = 'Password must be at least 8 characters long.';
			} else if (!passwordRequirements.test(passwordValue)) {
				newErrors.newPassword = 'Password must include letters, numbers, and a special character.';
			}

			if (!formValues.confirmPassword) {
				newErrors.confirmPassword = 'Confirm your new password.';
			} else if (formValues.confirmPassword !== formValues.newPassword) {
				newErrors.confirmPassword = 'Passwords do not match.';
			}
		}

		if ((wantsEmailChange || wantsPasswordChange) && !formValues.currentPassword) {
			newErrors.currentPassword = 'Enter your current password to continue.';
		}

		return newErrors;
	};

	const handleReset = () => {
		setFormValues({
			email: initialEmail,
			currentPassword: '',
			newPassword: '',
			confirmPassword: ''
		});
		setErrors({});
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		setErrors({});

		const validationErrors = validate();
		if (Object.keys(validationErrors).length > 0) {
			setErrors(validationErrors);
			if (validationErrors.general) {
				toast.error(validationErrors.general);
			}
			return;
		}

		const trimmedEmail = (formValues.email || '').trim();
		const normalizedInitial = (initialEmail || '').trim().toLowerCase();
		const wantsEmailChange = trimmedEmail.toLowerCase() !== normalizedInitial;
		const wantsPasswordChange = Boolean(formValues.newPassword);

		const payload = {
			currentPassword: formValues.currentPassword
		};

		if (wantsEmailChange) {
			payload.email = trimmedEmail;
		}

		if (wantsPasswordChange) {
			payload.newPassword = formValues.newPassword;
		}

		setSubmitting(true);

		try {
			const response = await api.put('/api/admin/credentials', payload);
			toast.success(response?.data?.message || 'Account settings updated.');

			const updatedEmail = (response?.data?.email || trimmedEmail || initialEmail).trim();
			setInitialEmail(updatedEmail);
			setFormValues({
				email: updatedEmail,
				currentPassword: '',
				newPassword: '',
				confirmPassword: ''
			});

			if (typeof refreshUser === 'function') {
				try {
					await refreshUser();
				} catch (error) {
					// Silently ignore refresh errors; session may have expired.
				}
			}
		} catch (error) {
			const message = error?.response?.data?.message || 'Failed to update account settings.';
			toast.error(message);

			if (error?.response?.status === 409) {
				setErrors((prev) => ({ ...prev, email: message }));
			} else if (error?.response?.status === 400) {
				if (/email/i.test(message)) {
					setErrors((prev) => ({ ...prev, email: message }));
				} else if (/password/i.test(message)) {
					setErrors((prev) => ({ ...prev, newPassword: message }));
				} else if (/current password/i.test(message)) {
					setErrors((prev) => ({ ...prev, currentPassword: message }));
				} else {
					setErrors((prev) => ({ ...prev, general: message }));
				}
			} else {
				setErrors((prev) => ({ ...prev, general: message }));
			}
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="min-h-full bg-slate-50/60 px-4 pb-6 pt-24 sm:px-6 sm:pb-8 sm:pt-10 lg:px-8 lg:pb-10">
			<div className="max-w-3xl mx-auto space-y-6">
				<header className="space-y-2">
					<div className="flex items-start gap-4">
						<div className="flex-shrink-0 mt-0">
							<div className="rounded-md bg-green-50 text-green-700 p-2 shadow-sm">
								<FiSettings size={18} />
							</div>
						</div>

						<div className="min-w-0">
							<h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 truncate">Owner Account Settings</h1>
							<p className="mt-1 text-sm text-slate-500 truncate">Manage the owner's login email and password.</p>
						</div>
					</div>
				</header>

				<form onSubmit={handleSubmit} className="bg-white shadow-sm border border-slate-200 rounded-xl">
					<div className="border-b border-slate-200 px-6 py-4">
						<h2 className="text-lg font-medium text-slate-900">Account Credentials</h2>
						<p className="text-sm text-slate-500">Keep your contact email and password up-to-date to maintain secure access.</p>
					</div>

					<div className="px-6 py-6 space-y-6">
						<div>
							<label htmlFor="owner-email" className="block text-sm font-medium text-slate-700">
								Owner Email
							</label>
							<div className={`mt-2 flex items-center rounded-md border ${errors.email ? 'border-red-400' : 'border-slate-300'} bg-white focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500`}>
								<span className="px-3 text-slate-400">
									<HiOutlineMail size={18} />
								</span>
								<input
									id="owner-email"
									type="email"
									value={formValues.email}
									onChange={handleChange('email')}
									className="w-full rounded-r-md border-0 py-2 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
									placeholder="owner@example.com"
									autoComplete="email"
								/>
							</div>
							{errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
						</div>

						<div className="grid gap-6 md:grid-cols-2">
							<div className="md:col-span-2">
								<label htmlFor="owner-current-password" className="block text-sm font-medium text-slate-700">
									Current Password
								</label>
								<div className={`mt-2 flex items-center rounded-md border ${errors.currentPassword ? 'border-red-400' : 'border-slate-300'} bg-white focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500`}>
									<span className="px-3 text-slate-400">
										<FiLock size={18} />
									</span>
									<input
										id="owner-current-password"
										type="password"
										value={formValues.currentPassword}
										onChange={handleChange('currentPassword')}
										className="w-full rounded-r-md border-0 py-2 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
										placeholder="Enter current password"
										autoComplete="current-password"
									/>
								</div>
								{errors.currentPassword && <p className="mt-1 text-xs text-red-500">{errors.currentPassword}</p>}
							</div>

							<div>
								<label htmlFor="owner-new-password" className="block text-sm font-medium text-slate-700">
									New Password
								</label>
								<div className={`mt-2 flex items-center rounded-md border ${errors.newPassword ? 'border-red-400' : 'border-slate-300'} bg-white focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500`}>
									<span className="px-3 text-slate-400">
										<FiLock size={18} />
									</span>
									<input
										id="owner-new-password"
										type="password"
										value={formValues.newPassword}
										onChange={handleChange('newPassword')}
										className="w-full rounded-r-md border-0 py-2 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
										placeholder="Leave blank to keep current password"
										autoComplete="new-password"
									/>
								</div>
								{errors.newPassword && <p className="mt-1 text-xs text-red-500">{errors.newPassword}</p>}
							</div>

							<div>
								<label htmlFor="owner-confirm-password" className="block text-sm font-medium text-slate-700">
									Confirm New Password
								</label>
								<div className={`mt-2 flex items-center rounded-md border ${errors.confirmPassword ? 'border-red-400' : 'border-slate-300'} bg-white focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500`}>
									<span className="px-3 text-slate-400">
										<FiLock size={18} />
									</span>
									<input
										id="owner-confirm-password"
										type="password"
										value={formValues.confirmPassword}
										onChange={handleChange('confirmPassword')}
										className="w-full rounded-r-md border-0 py-2 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
										placeholder="Retype new password"
										autoComplete="new-password"
									/>
								</div>
								{errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
							</div>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="text-xs text-slate-500">
								Passwords must be at least 8 characters long and should combine letters, numbers, and symbols for best security.
							</div>
							<div className="flex gap-3">
								<button
									type="button"
									onClick={handleReset}
									className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
									disabled={submitting}
								>
									Reset
								</button>
								<button
									type="submit"
									disabled={!hasChanges || submitting}
									className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors ${
										!hasChanges || submitting
											? 'bg-green-300 cursor-not-allowed'
											: 'bg-green-600 hover:bg-green-700'
									}`}
								>
									{submitting ? 'Saving…' : 'Save Changes'}
								</button>
							</div>
						</div>

						{errors.general && <p className="text-sm text-red-500">{errors.general}</p>}
					</div>
				</form>
			</div>
		</div>
	);
}

export default Settings;
