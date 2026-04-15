

# Digital Student ID Generation & Management System
## S.T.A.R_ID

### Overview
A full-stack web application that digitizes the entire student ID lifecycle — from application and photo upload, through admin verification, to virtual ID generation, status tracking, and lost/found management. Built with React + Supabase with real authentication restricted to `@student.egerton.ac.ke` emails.

---

### Phase 1: Foundation & Authentication

**Database Setup (Supabase)**
- Profiles table linked to `auth.users` (name, reg number, faculty, campus, course, year of study)
- User roles table (student, admin) with secure role-checking function
- RLS policies on all tables

**Authentication**
- Login/signup page with Supabase Auth restricted to `@student.egerton.ac.ke` emails
- Email verification flow
- Auto-create student profile on signup
- Separate admin login (admin role assigned via database)

---

### Phase 2: Student Portal

**Profile & Application Flow**
- Student dashboard showing current ID status and notifications
- Profile completion form: confirm/edit personal details (name, reg number, faculty, campus, course)
- Passport photo upload to Supabase Storage with client-side validation (file type, size, aspect ratio)
- Application submission with status indicator

**Virtual ID Card**
- Modern digital card design inspired by the physical S.T.A.R_ID ID
- Includes: student photo, name, reg number, course, faculty, campus, expiry date
- QR code containing verification data (scannable to verify authenticity)
- Downloadable as an image
- Card back with university details and barcode

**Status Tracking Dashboard**
- Visual pipeline: Submitted → Verified → Approved → Printed → Ready for Collection
- Real-time status updates with timestamps
- Notification history

**Lost & Found Module (Student Side)**
- Report lost ID form with details (date, circumstances)
- View lost report status
- Apply for replacement ID
- Get notified if ID is found

---

### Phase 3: Admin Portal

**Verification Dashboard**
- Queue of pending student applications
- Side-by-side view: student details vs submitted photo
- Approve/reject with comments
- Batch operations for efficiency

**ID Management**
- View all generated IDs with search and filters
- Deactivate lost IDs
- Manage lost-and-found reports (mark as found, notify student)
- Generate batch print lists (exportable)

**Audit & Reporting**
- Activity logs for all admin actions (who approved what, when)
- Operational reports: IDs generated per period, pending queue size, lost ID stats
- Simple charts/stats on the admin dashboard

---

### Phase 4: System Features

**Notifications**
- In-app notification system for status changes, approvals, rejections, and found IDs
- Toast notifications for real-time feedback

**QR Verification Page**
- Public-facing page that validates a scanned QR code
- Shows student name, photo, reg number, and ID validity status
- No login required to verify (read-only public endpoint)

**Security & Governance**
- All photos stored in Supabase Storage (not database)
- Role-based access control (students see only their data, admins see all)
- Audit trail table recording all state changes
- Input validation on all forms using Zod

---

### Design Direction
- Clean, modern UI using the existing shadcn/ui component library
- S.T.A.R_ID green (#00843D) as the primary accent color
- Mobile-responsive design throughout
- The virtual ID card will feature a modern redesign with gradient green styling, university branding, and a prominent QR code

---

### Pages Summary
1. **Login/Signup** — email auth with @student.egerton.ac.ke restriction
2. **Student Dashboard** — status overview, notifications, quick actions
3. **Application Form** — profile details + photo upload
4. **Virtual ID View** — digital ID card with QR code + download
5. **Lost ID Report** — report and track lost IDs
6. **Admin Dashboard** — stats, pending queue, recent activity
7. **Admin Verification** — review and approve/reject applications
8. **Admin ID Management** — search, deactivate, manage all IDs
9. **QR Verification** — public page for scanning and verifying IDs

