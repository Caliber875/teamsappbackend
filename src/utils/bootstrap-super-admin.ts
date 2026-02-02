import User from '../models/User';
import { PasswordUtils } from './password.utils';

export async function bootstrapSuperAdmin(): Promise<void> {
    try {
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
        const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

        if (!superAdminEmail || !superAdminPassword) {
            console.warn('⚠️  SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set. Skipping super admin bootstrap.');
            return;
        }

        // Check if any super admin exists OR if user with this email already exists
        const [existingSuperAdmin, existingUserByEmail] = await Promise.all([
            User.findOne({
                role: 'super_admin',
                disabled: false,
                deletedAt: null
            }),
            User.findOne({ email: superAdminEmail.toLowerCase() })
        ]);

        if (existingSuperAdmin) {
            console.log('✅ Super admin already exists. Skipping bootstrap.');
            return;
        }

        if (existingUserByEmail) {
            // User exists but is not a super admin - check if it's from Google OAuth
            if (!existingUserByEmail.passwordHash) {
                console.log('⚠️  User with super admin email exists (from Google OAuth) but has no password.');
                console.log('   Upgrading to super admin role and setting password...');

                // Validate password complexity
                const validation = PasswordUtils.validatePasswordComplexity(superAdminPassword);
                if (!validation.valid) {
                    console.error('❌ Super admin password does not meet complexity requirements:');
                    validation.errors.forEach(err => console.error(`   - ${err}`));
                    throw new Error('Super admin password validation failed');
                }

                // Upgrade existing user to super admin
                existingUserByEmail.passwordHash = await PasswordUtils.hashPassword(superAdminPassword);
                existingUserByEmail.role = 'super_admin';
                existingUserByEmail.tokenVersion = 0;
                existingUserByEmail.disabled = false;
                existingUserByEmail.deletedAt = null;
                existingUserByEmail.emailVerified = true;
                await existingUserByEmail.save();

                console.log(`✅ Upgraded existing user to super admin: ${existingUserByEmail.email}`);
                return;
            } else {
                console.log('✅ User with super admin email already exists. Skipping bootstrap.');
                return;
            }
        }

        // Validate password complexity
        const validation = PasswordUtils.validatePasswordComplexity(superAdminPassword);
        if (!validation.valid) {
            console.error('❌ Super admin password does not meet complexity requirements:');
            validation.errors.forEach(err => console.error(`   - ${err}`));
            throw new Error('Super admin password validation failed');
        }

        // Hash password
        const passwordHash = await PasswordUtils.hashPassword(superAdminPassword);

        // Create super admin
        const superAdmin = await User.create({
            email: superAdminEmail.toLowerCase(),
            passwordHash,
            role: 'super_admin',
            tokenVersion: 0,
            disabled: false,
            deletedAt: null,
            emailVerified: true,
            profile: {
                name: 'Super Admin',
                status: 'offline',
                timezone: 'UTC'
            },
            workspaceIds: [],
            security: {
                failedAttempts: 0,
                loginHistory: [],
                mustChangePassword: false
            }
        });

        console.log(`✅ Super admin created successfully: ${superAdmin.email}`);
    } catch (error) {
        console.error('❌ Failed to bootstrap super admin:', error);
        throw error;
    }
}
