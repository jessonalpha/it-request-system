require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const bcrypt = require('bcryptjs'); // Only ONE bcrypt import now!
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


// ==========================================
// DATABASE CONFIGURATION
// ==========================================
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

const adapter = new PrismaLibSql({ url: "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = 5000;
const JWT_SECRET = 'my-super-secret-key-12345'; 

// Standard Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true 
}));

// File Upload Configuration
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// JWT PROTECTION MIDDLEWARE 
// ==========================================
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = decoded;
        next();
    });
};

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================
app.post('/api/auth/setup', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash('password123', 10);
        const user = await prisma.user.create({
            data: { email: 'admin@corporate.com', password: hashedPassword, role: 'Super_Admin' }
        });
        res.json({ message: "Test user created!", user });
    } catch (error) {
        console.error("SETUP CRASH:", error); 
        res.status(500).json({ error: "Setup failed", details: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: false, 
            sameSite: 'lax',
            maxAge: 3600000 
        });

        res.json({ message: "Logged in successfully", token, role: user.role });
    } catch (error) {
        console.error("BACKEND CRASH:", error); 
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

// ==========================================
// NOTIFICATIONS
// ==========================================
app.get('/api/notifications', requireAuth, async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});

app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
    try {
        await prisma.notification.update({
            where: { id: parseInt(req.params.id) },
            data: { isRead: true }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to update notification" });
    }
});

app.delete('/api/notifications/:id', requireAuth, async (req, res) => {
    try {
        await prisma.notification.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete notification" });
    }
});

app.delete('/api/notifications', requireAuth, async (req, res) => {
    try {
        await prisma.notification.deleteMany({
            where: { userId: req.user.id }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to clear notifications" });
    }
});

app.post('/api/notifications/push', requireAuth, async (req, res) => {
    if (req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const { title, description, dueDate } = req.body;
        const users = await prisma.user.findMany();
        
        const notifications = users.map(u => ({
            userId: u.id, title, description,
            dueDate: dueDate ? new Date(dueDate) : null
        }));

        await prisma.notification.createMany({ data: notifications });
        res.json({ success: true, count: users.length });
    } catch (error) {
        res.status(500).json({ error: "Failed to push notification" });
    }
});

// ==========================================
// SUPER ADMIN: BRANDING & HOTEL SETTINGS
// ==========================================
app.get('/api/settings', async (req, res) => {
    try {
        let settings = await prisma.tenant_Settings.findUnique({ where: { id: 1 } });
        if (!settings) settings = await prisma.tenant_Settings.create({ data: { id: 1 } });
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

app.put('/api/settings', requireAuth, upload.single('logo'), async (req, res) => {
    if (req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const { companyName } = req.body;
        let updateData = { companyName };
        if (req.file) updateData.logoUrl = `/uploads/${req.file.filename}`;

        const updatedSettings = await prisma.tenant_Settings.update({
            where: { id: 1 }, data: updateData
        });
        res.json(updatedSettings);
    } catch (error) {
        res.status(500).json({ error: "Failed to update settings" });
    }
});

// ==========================================
// PROPERTIES ENDPOINTS (Updated for Isolation)
// ==========================================
app.get('/api/properties', requireAuth, async (req, res) => {
    try {
        const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        let whereClause = { isActive: true };

        // If not Super Admin, restrict to their primary property + permitted multi-properties
        if (currentUser.role !== 'Super_Admin') {
            let allowedProps = currentUser.propertyId ? [currentUser.propertyId] : [];
            const perms = currentUser.permissions ? JSON.parse(currentUser.permissions) : {};
            
            if (perms.multi_property && Array.isArray(perms.multi_property)) {
                allowedProps = [...new Set([...allowedProps, ...perms.multi_property])];
            }
            whereClause.id = { in: allowedProps };
        }

        const properties = await prisma.property.findMany({ where: whereClause });
        res.json(properties);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch properties" });
    }
});
app.post('/api/properties', requireAuth, async (req, res) => {
    if (req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const { name, code, address, landphone, location, facebook, instagram, youtube, linkedin, threads, website } = req.body;
        const newProperty = await prisma.property.create({
            data: { name, code, address, landphone, location, facebook, instagram, youtube, linkedin, threads, website }
        });
        res.status(201).json(newProperty);
    } catch (error) {
        res.status(500).json({ error: "Failed to add property" });
    }
});

app.put('/api/properties/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const { name, code, address, landphone, location, facebook, instagram, youtube, linkedin, threads, website } = req.body;
        const updatedProperty = await prisma.property.update({
            where: { id: parseInt(req.params.id) },
            data: { name, code, address, landphone, location, facebook, instagram, youtube, linkedin, threads, website }
        });
        res.json(updatedProperty);
    } catch (error) {
        res.status(500).json({ error: "Failed to edit property" });
    }
});

app.delete('/api/properties/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        await prisma.property.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: "Property deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Cannot delete hotel. Ensure no users are assigned." });
    }
});

// ==========================================
// SUPER ADMIN: PERMISSIONS & AUDIT LOGS
// ==========================================
app.patch('/api/users/:id/permissions', requireAuth, async (req, res) => {
    if (req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const { permissions } = req.body;
        const updatedUser = await prisma.user.update({
            where: { id: parseInt(req.params.id) },
            data: { permissions: JSON.stringify(permissions) }
        });
        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: "Failed to update permissions" });
    }
});

app.get('/api/audit', requireAuth, async (req, res) => {
    if (req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const tickets = await prisma.request.findMany({ include: { user: true } });
        const projects = await prisma.project.findMany({ include: { user: true } });
        const checklists = await prisma.checklistLog.findMany({ include: { user: true, template: true } });
        const users = await prisma.user.findMany();
        const resources = await prisma.resource.findMany({ include: { uploadedBy: true }});

        let auditTrail = [];
        
        tickets.forEach(t => auditTrail.push({ date: t.createdAt, user: t.user?.email, action: 'Created Ticket', module: 'Tickets', details: `Ticket ID: ${t.ticketNum}` }));
        projects.forEach(p => auditTrail.push({ date: p.createdAt, user: p.user?.email, action: 'Drafted Project', module: 'Projects', details: `Project ID: ${p.projectNum}` }));
        checklists.forEach(c => auditTrail.push({ date: c.date, user: c.user?.email, action: 'Submitted Checklist', module: 'Checklists', details: `Template: ${c.template?.title}` }));
        resources.forEach(r => auditTrail.push({ date: r.createdAt, user: r.uploadedBy?.email, action: 'Uploaded Resource', module: 'Resource Hub', details: `File: ${r.title}` }));
        users.forEach(u => auditTrail.push({ date: u.createdAt, user: 'System Admin', action: 'User Registered', module: 'User Management', details: `Email: ${u.email}` }));

        auditTrail.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(auditTrail);
    } catch (error) { 
        res.status(500).json({ error: "Failed to generate audit log" }); 
    }
});

// ==========================================
// USER MANAGEMENT (Updated for Isolation)
// ==========================================
app.get('/api/users', requireAuth, async (req, res) => {
    try {
        const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        let whereClause = {};

        // Restrict Admins to viewing only users within their allowed properties
        if (currentUser.role !== 'Super_Admin') {
            let allowedProps = currentUser.propertyId ? [currentUser.propertyId] : [];
            const perms = currentUser.permissions ? JSON.parse(currentUser.permissions) : {};
            
            if (perms.multi_property && Array.isArray(perms.multi_property)) {
                allowedProps = [...new Set([...allowedProps, ...perms.multi_property])];
            }
            whereClause.propertyId = { in: allowedProps };
        }

        const users = await prisma.user.findMany({ 
            where: whereClause,
            include: { property: true } 
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

app.post('/api/users', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const { firstName, lastName, email, password, role, phone, propertyId } = req.body; 
        
        // Block Admins from creating "Global" users
        if (req.user.role === 'Admin' && (!propertyId || propertyId === 'Global')) {
            return res.status(403).json({ error: "Admins must assign users to a property." });
        }

        const newUser = await prisma.user.create({
            data: { 
                firstName: firstName ?? null,
                lastName: lastName ?? null,
                email, password, role, phone,
                propertyId: propertyId && propertyId !== 'Global' ? parseInt(propertyId) : null 
            },
            include: { property: true }
        });
        res.status(201).json(newUser);
    } catch (error) {
        res.status(500).json({ error: "Failed to create user" });
    }
});

app.put('/api/users/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const { firstName, lastName, role, phone, propertyId } = req.body;

        if (req.user.role === 'Admin' && (!propertyId || propertyId === 'Global')) {
            return res.status(403).json({ error: "Admins must assign users to a property." });
        }

        const updatedUser = await prisma.user.update({
            where: { id: parseInt(req.params.id) },
            data: { 
                firstName: firstName ?? null,
                lastName: lastName ?? null,
                role, phone,
                propertyId: propertyId && propertyId !== 'Global' ? parseInt(propertyId) : null
            },
            include: { property: true }
        });
        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: "Failed to update user" });
    }
});

app.delete('/api/users/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        await prisma.user.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete user" });
    }
});

app.patch('/api/users/:id/reset-password', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    await prisma.user.update({
        where: { id: parseInt(req.params.id) },
        data: { password: hashedPassword }
    });
    
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password reset error:", error); 
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// ==========================================
// TICKET / REQUEST MANAGEMENT
// ==========================================
app.get('/api/requests', requireAuth, async (req, res) => {
    try {
        const { propertyFilter } = req.query; // e.g., "All" or "2"
        const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        
        let allowedProps = [];
        if (currentUser.role !== 'Super_Admin') {
            allowedProps = currentUser.propertyId ? [currentUser.propertyId] : [];
            const perms = currentUser.permissions ? JSON.parse(currentUser.permissions) : {};
            if (perms.multi_property) allowedProps = [...new Set([...allowedProps, ...perms.multi_property])];
        }

        let whereClause = {};

        // --- FILTERING LOGIC ---
        if (propertyFilter && propertyFilter !== 'All') {
            const targetPropId = parseInt(propertyFilter);
            // Security check: Ensure they are Super Admin OR have explicit access to this property
            if (currentUser.role === 'Super_Admin' || allowedProps.includes(targetPropId)) {
                // Assuming Tickets are linked to properties via the user who created them:
                whereClause.user = { propertyId: targetPropId }; 
            } else {
                return res.status(403).json({ error: "Access denied to this property context." });
            }
        } else if (currentUser.role !== 'Super_Admin') {
            // If an Admin somehow requests "All", force-filter to only their allowed properties
            whereClause.user = { propertyId: { in: allowedProps } };
        }

        // --- STANDARD USER ISOLATION ---
        if (currentUser.role === 'User') {
            whereClause = {
                ...whereClause,
                OR: [
                    { userId: currentUser.id },
                    { taggedUsers: { some: { id: currentUser.id } } }
                ]
            };
        }

        const requests = await prisma.request.findMany({
            where: whereClause,
            include: { user: true, taggedUsers: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch tickets" });
    }
});

app.get('/api/requests/:id', requireAuth, async (req, res) => {
    try {
        const request = await prisma.request.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { 
                user: { select: { email: true, role: true, firstName: true, lastName: true } },
                taggedUsers: true,
                comments: { 
                    include: { user: { select: { email: true, role: true, firstName: true, lastName: true } } },
                    orderBy: { createdAt: 'asc' } 
                } 
            }
        });
        if (!request) return res.status(404).json({ error: "Ticket not found" });
        res.json(request);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch ticket details" });
    }
});

app.post('/api/requests', requireAuth, async (req, res) => {
    try {
        const { title, description, category, priority, taggedUserIds } = req.body;
        
        const connectTags = taggedUserIds && taggedUserIds.length > 0 
            ? { connect: taggedUserIds.map(id => ({ id: parseInt(id) })) }
            : undefined;

        const ticketNum = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;

        const newTicket = await prisma.request.create({
            data: {
                ticketNum, title, description, category, priority,
                userId: req.user.id,     
                taggedUsers: connectTags 
            },
            include: { user: true, taggedUsers: true }
        });

        if (taggedUserIds && taggedUserIds.length > 0) {
            const notifications = taggedUserIds.map(id => ({
                userId: parseInt(id),
                title: `You were tagged in a new ticket`,
                description: `Ticket ${newTicket.ticketNum}: ${title}`
            }));
            await prisma.notification.createMany({ data: notifications });
        }

        res.status(201).json(newTicket);
    } catch (error) {
        res.status(500).json({ error: "Failed to create ticket" });
    }
});

app.put('/api/requests/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const { title, description, category, priority, taggedUserIds } = req.body;

        const connectTags = taggedUserIds 
            ? { set: taggedUserIds.map(id => ({ id: parseInt(id) })) } 
            : undefined;

        const updatedTicket = await prisma.request.update({
            where: { id: parseInt(req.params.id) },
            data: { 
                title, description, category, priority,
                ...(connectTags && { taggedUsers: connectTags })
            },
            include: { user: true, taggedUsers: true }
        });

        if (taggedUserIds && taggedUserIds.length > 0) {
            const notifications = taggedUserIds.map(id => ({
                userId: parseInt(id),
                title: `Update on Ticket ${updatedTicket.ticketNum}`,
                description: `Modifications were made to a ticket you are tagged in.`
            }));
            await prisma.notification.createMany({ data: notifications });
        }

        res.json(updatedTicket);
    } catch (error) {
        res.status(500).json({ error: "Failed to update ticket" });
    }
});

app.patch('/api/requests/:id/status', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const { status } = req.body;
        const updatedTicket = await prisma.request.update({
            where: { id: parseInt(req.params.id) },
            data: { status }
        });
        res.json(updatedTicket);
    } catch (error) {
        res.status(500).json({ error: "Failed to update ticket status" });
    }
});

app.delete('/api/requests/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        await prisma.request.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: "Ticket deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete ticket" });
    }
});

app.post('/api/requests/:id/comments', requireAuth, upload.single('document'), async (req, res) => {
    try {
        const { message } = req.body;
        const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
        const fileName = req.file ? req.file.originalname : null;

        const newComment = await prisma.comment.create({
            data: {
                message: message || "", 
                fileUrl, fileName,
                requestId: parseInt(req.params.id),
                userId: req.user.id
            },
            include: { user: { select: { email: true, role: true, firstName: true, lastName: true } } }
        });
        res.status(201).json(newComment);
    } catch (error) {
        res.status(500).json({ error: "Failed to post comment" });
    }
});

// ==========================================
// PROJECT MANAGEMENT ENDPOINTS
// ==========================================
app.get('/api/projects', requireAuth, async (req, res) => {
    try {
        let whereClause = {};
        if (req.user.role === 'User') {
            whereClause = {
                OR: [
                    { userId: req.user.id },
                    { taggedUsers: { some: { id: req.user.id } } }
                ]
            };
        }

        const projects = await prisma.project.findMany({
            where: whereClause,
            include: { user: true, taggedUsers: true, property: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(projects);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch projects" });
    }
});

app.post('/api/projects', requireAuth, async (req, res) => {
    try {
        const { title, description, priority, budget, targetDate, propertyId, taggedUserIds } = req.body;
        
        const connectTags = taggedUserIds && taggedUserIds.length > 0 
            ? { connect: taggedUserIds.map(id => ({ id: parseInt(id) })) }
            : undefined;

        const projectNum = `PRJ-${Math.floor(1000 + Math.random() * 9000)}`;

        const newProject = await prisma.project.create({
            data: {
                projectNum, title, description, priority,
                budget: budget ? parseFloat(budget) : null,
                targetDate: targetDate ? new Date(targetDate) : null,
                propertyId: propertyId ? parseInt(propertyId) : null,
                userId: req.user.id,     
                taggedUsers: connectTags 
            },
            include: { user: true, taggedUsers: true, property: true }
        });

        if (taggedUserIds && taggedUserIds.length > 0) {
            const notifications = taggedUserIds.map(id => ({
                userId: parseInt(id),
                title: `You were tagged in a new Project`,
                description: `${newProject.projectNum}: ${title}`
            }));
            await prisma.notification.createMany({ data: notifications });
        }

        res.status(201).json(newProject);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create project" });
    }
});

app.put('/api/projects/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const { title, description, priority, budget, targetDate, propertyId, taggedUserIds } = req.body;

        const connectTags = taggedUserIds 
            ? { set: taggedUserIds.map(id => ({ id: parseInt(id) })) } 
            : undefined;

        const updatedProject = await prisma.project.update({
            where: { id: parseInt(req.params.id) },
            data: { 
                title, description, priority,
                budget: budget ? parseFloat(budget) : null,
                targetDate: targetDate ? new Date(targetDate) : null,
                propertyId: propertyId ? parseInt(propertyId) : null,
                ...(connectTags && { taggedUsers: connectTags })
            },
            include: { user: true, taggedUsers: true, property: true }
        });

        res.json(updatedProject);
    } catch (error) {
        res.status(500).json({ error: "Failed to update project" });
    }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        await prisma.project.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: "Project deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete project" });
    }
});

app.get('/api/projects/:id', requireAuth, async (req, res) => {
    try {
        const project = await prisma.project.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                user: { select: { email: true, firstName: true, lastName: true } },
                property: true,
                taggedUsers: true,
                quotes: { include: { uploadedBy: { select: { firstName: true, lastName: true, email: true } } }, orderBy: { amount: 'asc' } },
                comments: { include: { user: { select: { email: true, role: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'asc' } }
            }
        });
        if (!project) return res.status(404).json({ error: "Project not found" });
        res.json(project);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch project details" });
    }
});

app.patch('/api/projects/:id/status', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const { status } = req.body;
        const updateData = { status };
        
        if (status === 'Completed') updateData.completedAt = new Date();
        else updateData.completedAt = null; 
        
        const updatedProject = await prisma.project.update({
            where: { id: parseInt(req.params.id) },
            data: updateData
        });
        res.json(updatedProject);
    } catch (error) {
        res.status(500).json({ error: "Failed to update project status" });
    }
});

// ==========================================
// QUOTATIONS ENGINES (WITH PERMISSIONS)
// ==========================================

// Helper function to check quotation permissions
const checkQuotePermission = async (userId, permissionKey) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.role === 'Admin' || user.role === 'Super_Admin') return true; // Admins always have access
    const perms = user.permissions ? JSON.parse(user.permissions) : {};
    return !!perms[permissionKey]; // Return true if the specific permission is toggled on
};

// 1. ADD QUOTE
app.post('/api/projects/:id/quotes', requireAuth, upload.single('document'), async (req, res) => {
    try {
        const hasPermission = await checkQuotePermission(req.user.userId, 'add_quotes');
        if (!hasPermission) return res.status(403).json({ error: "You do not have permission to add quotes." });

        const projectId = parseInt(req.params.id);
        const { vendorName, amount, description, isRevised } = req.body;
        
        const newQuote = await prisma.quote.create({
            data: {
                vendorName,
                amount: parseFloat(amount),
                description,
                isRevised: isRevised === 'true',
                fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
                projectId,
                uploadedById: req.user.userId
            },
            include: { uploadedBy: true }
        });
        res.status(201).json(newQuote);
    } catch (error) {
        console.error("Quote Upload Error:", error);
        res.status(500).json({ error: "Failed to upload quote" });
    }
});

// 2. EDIT QUOTE
app.put('/api/projects/:id/quotes/:quoteId', requireAuth, upload.single('document'), async (req, res) => {
    try {
        const hasPermission = await checkQuotePermission(req.user.userId, 'edit_quotes');
        if (!hasPermission) return res.status(403).json({ error: "You do not have permission to edit quotes." });

        const quoteId = parseInt(req.params.quoteId);
        const { vendorName, amount, description, isRevised } = req.body;
        
        const updateData = {
            vendorName,
            amount: parseFloat(amount),
            description,
            isRevised: isRevised === 'true'
        };

        if (req.file) {
            updateData.fileUrl = `/uploads/${req.file.filename}`;
        }
        
        const updatedQuote = await prisma.quote.update({
            where: { id: quoteId },
            data: updateData,
            include: { uploadedBy: true }
        });
        res.json(updatedQuote);
    } catch (error) {
        console.error("Quote Update Error:", error);
        res.status(500).json({ error: "Failed to update quote" });
    }
});

// 3. DELETE QUOTE
app.delete('/api/projects/:id/quotes/:quoteId', requireAuth, async (req, res) => {
    try {
        const hasPermission = await checkQuotePermission(req.user.userId, 'delete_quotes');
        if (!hasPermission) return res.status(403).json({ error: "You do not have permission to delete quotes." });

        const quoteId = parseInt(req.params.quoteId);
        await prisma.quote.delete({ where: { id: quoteId } });
        res.json({ message: "Quote successfully deleted." });
    } catch (error) {
        console.error("Quote Delete Error:", error);
        res.status(500).json({ error: "Failed to delete quote" });
    }
});

app.patch('/api/projects/:id/quotes/:quoteId/finalize', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const projectId = parseInt(req.params.id);
        
        await prisma.quote.updateMany({
            where: { projectId, isFinalized: true },
            data: { isFinalized: false }
        });

        const finalizedQuote = await prisma.quote.update({
            where: { id: parseInt(req.params.quoteId) },
            data: { isFinalized: true }
        });

        await prisma.project.update({
            where: { id: projectId },
            data: { status: 'Approved' }
        });

        res.json(finalizedQuote);
    } catch (error) {
        res.status(500).json({ error: "Failed to finalize quote" });
    }
});

app.post('/api/projects/:id/comments', requireAuth, upload.single('document'), async (req, res) => {
    try {
        const { message } = req.body;
        const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
        const fileName = req.file ? req.file.originalname : null;

        const newComment = await prisma.projectComment.create({
            data: {
                message: message || "", 
                fileUrl, fileName,
                projectId: parseInt(req.params.id),
                userId: req.user.id
            },
            include: { user: { select: { email: true, role: true, firstName: true, lastName: true } } }
        });
        res.status(201).json(newComment);
    } catch (error) {
        res.status(500).json({ error: "Failed to post comment" });
    }
});

// ==========================================
// AI QUOTE COMPARISON ENGINE (LOOP FIX)
// ==========================================
app.post('/api/projects/:id/quotes/compare', requireAuth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const { depth = "full", customPrompt = "" } = req.body;
        
        const quotes = await prisma.quote.findMany({
            where: { projectId },
            select: { id: true, vendorName: true, amount: true, fileUrl: true, description: true }
        });

        if (quotes.length < 2) return res.status(400).json({ error: "At least 2 quotes are required." });

        let depthInstruction = "";
        if (depth === "summary") {
            depthInstruction = "Focus strictly on total commercial values, payment milestones, delivery lead time, and high-level warranty terms.";
        } else if (depth === "full") {
            depthInstruction = "Extract an item-by-item breakdown mapping corresponding line items across all vendors (Description, Quantity, Unit Rate, Line Total).";
        } else {
            depthInstruction = "Provide an exhaustive audit: full line-item breakdown, technical compliance, exclusions, hidden costs, and risk assessment.";
        }

        // We inject the schema into the text prompt instead of using the API's strict responseSchema, 
        // which prevents the AI's internal token generator from freezing in a loop.
        const promptParts = [
            { text: `You are an expert IT Procurement and Cost-Audit Consultant. Analyze the attached vendor quotation PDFs.

Comparison Depth: ${depth.toUpperCase()}
Depth Guidance: ${depthInstruction}
${customPrompt ? `User Specific Instructions: "${customPrompt}"` : ""}

CRITICAL INSTRUCTIONS TO PREVENT REPETITION:
1. You MUST return ONLY a valid JSON object. Do NOT wrap it in markdown blocks like \`\`\`json.
2. Do NOT write paragraphs. Keep all text in "observations", "keyPros", and "keyCons" strictly to short bullet points (max 15 words per point).
3. If a PDF is unreadable, output "Information unavailable". Do NOT repeat yourself.

Return EXACTLY this JSON structure:
{
  "recommendedVendor": "Name of best-fit vendor",
  "vendors": [
    {
      "vendorName": "Vendor Name",
      "totalQuoted": "Total amount",
      "taxes": "GST/Tax details",
      "deliveryTimeline": "e.g. 2-3 weeks",
      "paymentTerms": "e.g. 50% advance",
      "warranty": "Warranty period",
      "keyPros": ["Advantage 1"],
      "keyCons": ["Risk 1"]
    }
  ],
  "itemizedMatrix": [
    {
      "itemDescription": "Item name",
      "quantity": "5",
      "vendorPrices": [
        {
          "vendorName": "Vendor Name",
          "brandModel": "Brand",
          "unitPrice": "100",
          "totalPrice": "500"
        }
      ]
    }
  ],
  "observations": ["Observation 1"]
}

Attached PDFs:` }
        ];

        for (const quote of quotes) {
            promptParts.push({ text: `\n\n=== VENDOR: ${quote.vendorName} ===\nAmount: ₹${quote.amount}\nNotes: ${quote.description || 'None'}` });
            
            if (quote.fileUrl && quote.fileUrl.toLowerCase().endsWith('.pdf')) {
                const localPath = quote.fileUrl.startsWith('/') ? quote.fileUrl.slice(1) : quote.fileUrl;
                const filePath = path.join(__dirname, localPath);
                
                if (fs.existsSync(filePath)) {
                    const pdfBase64 = Buffer.from(fs.readFileSync(filePath)).toString("base64");
                    promptParts.push({
                        inlineData: { data: pdfBase64, mimeType: "application/pdf" }
                    });
                } else {
                    promptParts.push({ text: "(PDF File missing from server)" });
                }
            } else {
                promptParts.push({ text: "(No valid PDF document attached)" });
            }
        }

        const aiResponse = await ai.models.generateContent({
            model: "gemini-3.6-flash", 
            contents: promptParts,
            config: {
                responseMimeType: "application/json",
                // Temperature increased to 0.7 to completely eliminate degenerate loop likelihood
                temperature: 0.7 
            }
        });

        const rawText = aiResponse.text.replace(/```json\n?|```/g, '').trim();
        res.json(JSON.parse(rawText));

    } catch (error) {
        console.error("AI Quote Comparison Error Details:", error);
        res.status(500).json({ error: error.message || "Failed to generate AI comparison." });
    }
});

// ==========================================
// ADVANCED REPORTING ENGINE
// ==========================================
app.get('/api/reports/tickets', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });

    const { startDate, endDate, status, userId, propertyId } = req.query;
    let whereClause = {};

    if (status && status !== 'All') whereClause.status = status;

    if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            whereClause.createdAt.lte = end;
        }
    }

    if (userId && userId !== 'All') whereClause.userId = parseInt(userId);

    if (propertyId && propertyId !== 'All') {
        whereClause.user = {
            ...whereClause.user,
            propertyId: parseInt(propertyId)
        };
    }

    try {
        const requests = await prisma.request.findMany({
            where: whereClause,
            include: { user: { include: { property: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: "Failed to generate report data" });
    }
});

// ==========================================
// AMC & LICENSE MANAGEMENT ENDPOINTS
// ==========================================
app.get('/api/amcs', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const contracts = await prisma.aMC_Contract.findMany({ orderBy: { expiryDate: 'asc' } });
        res.json(contracts);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch contracts" });
    }
});

app.post('/api/amcs', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        // Extract the new fields (propertyId, notes) sent by the frontend
        const { type, vendorProduct, cost, startDate, expiryDate, propertyId, notes } = req.body;
        
        const expDate = new Date(expiryDate);
        const diffDays = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));

        let initialStatus = "Active";
        if (diffDays < 0) initialStatus = "Expired";
        else if (diffDays <= 90) initialStatus = "Expiring_Soon";

        const newContract = await prisma.aMC_Contract.create({
            data: { 
                type, 
                vendorProduct, 
                cost: parseFloat(cost) || 0, 
                startDate: startDate ? new Date(startDate) : new Date(), // Graceful fallback
                expiryDate: expDate,
                status: initialStatus,
                notes: notes || "", 
                propertyId: propertyId ? parseInt(propertyId) : null
            }
        });
        res.status(201).json(newContract);
    } catch (error) {
        console.error("AMC POST Error:", error);
        res.status(500).json({ error: "Failed to add contract" });
    }
});

app.get('/api/amcs/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const contract = await prisma.aMC_Contract.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { attachments: { orderBy: { uploadedAt: 'desc' } } }
        });
        if (!contract) return res.status(404).json({ error: "AMC not found" });
        res.json(contract);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch contract details" });
    }
});

app.put('/api/amcs/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        // Extract the new fields (propertyId, notes)
        const { type, vendorProduct, cost, startDate, expiryDate, propertyId, notes } = req.body;
        
        const expDate = new Date(expiryDate);
        const diffDays = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));

        let initialStatus = "Active";
        if (diffDays < 0) initialStatus = "Expired";
        else if (diffDays <= 90) initialStatus = "Expiring_Soon";

        const updatedContract = await prisma.aMC_Contract.update({
            where: { id: parseInt(req.params.id) },
            data: { 
                type, 
                vendorProduct, 
                cost: parseFloat(cost) || 0, 
                startDate: startDate ? new Date(startDate) : new Date(),
                expiryDate: expDate, 
                status: initialStatus,
                notes: notes || "",
                propertyId: propertyId ? parseInt(propertyId) : null
            }
            // Note: If you don't have attachments working yet, you can leave include: { attachments: true } out.
        });
        res.json(updatedContract);
    } catch (error) {
        console.error("AMC PUT Error:", error);
        res.status(500).json({ error: "Failed to update contract" });
    }
});

app.delete('/api/amcs/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        await prisma.aMC_Contract.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: "Contract deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete contract" });
    }
});

app.post('/api/amcs/:id/attachments', requireAuth, upload.single('document'), async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        
        const newAttachment = await prisma.aMCAttachment.create({
            data: {
                fileUrl: `/uploads/${req.file.filename}`,
                fileName: req.file.originalname,
                amcId: parseInt(req.params.id)
            }
        });
        res.status(201).json(newAttachment);
    } catch (error) {
        res.status(500).json({ error: "Failed to upload attachment" });
    }
});

app.delete('/api/amcs/attachments/:attachmentId', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        await prisma.aMCAttachment.delete({ where: { id: parseInt(req.params.attachmentId) } });
        res.json({ message: "Attachment deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete attachment" });
    }
});

// ==========================================
// ROUTINE CHECKLIST ENDPOINTS
// ==========================================
app.get('/api/checklists', requireAuth, async (req, res) => {
    try {
        let whereClause = {};
        
        if (req.user.role === 'User') {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            whereClause = {
                OR: [
                    { propertyId: null },
                    { propertyId: user.propertyId }
                ]
            };
        }
        
        const checklists = await prisma.checklistTemplate.findMany({
            where: whereClause,
            include: { property: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(checklists);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch checklists" });
    }
});

app.post('/api/checklists', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const { title, description, frequency, tasks, propertyId } = req.body;
        const newChecklist = await prisma.checklistTemplate.create({
            data: {
                title, description, frequency,
                tasks: JSON.stringify(tasks), 
                propertyId: propertyId && propertyId !== 'Global' ? parseInt(propertyId) : null
            },
            include: { property: true }
        });
        res.status(201).json(newChecklist);
    } catch (error) {
        res.status(500).json({ error: "Failed to create checklist template" });
    }
});

app.put('/api/checklists/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        const { title, description, frequency, tasks, propertyId } = req.body;
        const updatedChecklist = await prisma.checklistTemplate.update({
            where: { id: parseInt(req.params.id) },
            data: {
                title, description, frequency,
                tasks: JSON.stringify(tasks),
                propertyId: propertyId && propertyId !== 'Global' ? parseInt(propertyId) : null
            },
            include: { property: true }
        });
        res.json(updatedChecklist);
    } catch (error) {
        res.status(500).json({ error: "Failed to update checklist template" });
    }
});

app.delete('/api/checklists/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        await prisma.checklistTemplate.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: "Checklist template deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete checklist template" });
    }
});

app.post('/api/checklists/:id/logs', requireAuth, async (req, res) => {
    try {
        const { responses, notes } = req.body;
        const newLog = await prisma.checklistLog.create({
            data: {
                templateId: parseInt(req.params.id),
                userId: req.user.id,
                responses: JSON.stringify(responses),
                notes,
                status: 'Completed'
            },
            include: { 
                user: { select: { firstName: true, lastName: true, email: true } }, 
                template: true 
            }
        });
        res.status(201).json(newLog);
    } catch (error) {
        res.status(500).json({ error: "Failed to submit checklist log" });
    }
});

app.get('/api/checklists/logs', requireAuth, async (req, res) => {
    try {
        let whereClause = {};
        if (req.user.role === 'User') {
            whereClause = { userId: req.user.id };
        }
        
        const logs = await prisma.checklistLog.findMany({
            where: whereClause,
            include: { 
                user: { select: { firstName: true, lastName: true, email: true } }, 
                template: true 
            },
            orderBy: { date: 'desc' }
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch checklist logs" });
    }
});

// ==========================================
// EMAIL SETTINGS (IMAP / WEBHOOK) STUB
// ==========================================
let mockEmailConfigs = []; // Temporary in-memory array until Prisma schema is updated

app.get('/api/email-settings', requireAuth, (req, res) => {
    if (req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    res.json(mockEmailConfigs);
});

app.post('/api/email-settings', requireAuth, (req, res) => {
    if (req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    const newConfig = { id: Date.now(), ...req.body };
    mockEmailConfigs.push(newConfig);
    res.status(201).json(newConfig);
});

app.delete('/api/email-settings/:id', requireAuth, (req, res) => {
    if (req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    mockEmailConfigs = mockEmailConfigs.filter(c => c.id !== parseInt(req.params.id));
    res.json({ success: true });
});

// ==========================================
// AUTOMATED CRON REMINDER ENGINE
// ==========================================
cron.schedule('0 8 * * *', async () => {
    console.log("Running daily AMC expiration check...");
    try {
        const today = new Date();
        const activeContracts = await prisma.aMC_Contract.findMany({ 
            where: { status: { notIn: ['Renewed', 'Canceled'] } } 
        });

        for (const contract of activeContracts) {
            const diffDays = Math.ceil((new Date(contract.expiryDate) - today) / (1000 * 60 * 60 * 24));

            if (diffDays < 0 && contract.status !== 'Expired') {
                await prisma.aMC_Contract.update({
                    where: { id: contract.id }, data: { status: 'Expired' }
                });
            } else if (diffDays <= 90 && diffDays >= 0 && contract.status === 'Active') {
                await prisma.aMC_Contract.update({
                    where: { id: contract.id }, data: { status: 'Expiring_Soon' }
                });
            }

            if (diffDays === 30) {
                const adminUser = await prisma.user.findFirst({ 
                    where: { role: { in: ['Super_Admin', 'Admin'] } } 
                });
                
                if (adminUser) {
                    await prisma.request.create({
                        data: {
                            ticketNum: `AMC-${Math.floor(1000 + Math.random() * 9000)}`,
                            title: `URGENT: License Renewal Required for ${contract.vendorProduct}`,
                            description: `The AMC/License for ${contract.vendorProduct} is expiring in exactly 30 days.`,
                            category: 'AMC_Renewal', priority: 'High', status: 'Open',
                            userId: adminUser.id
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.error("CRON Engine Error:", error);
    }
});

// ==========================================
// RESOURCE HUB ENDPOINTS
// ==========================================
app.get('/api/resources', requireAuth, async (req, res) => {
    try {
        const resources = await prisma.resource.findMany({
            include: { uploadedBy: { select: { firstName: true, lastName: true, email: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(resources);
    } catch (error) { res.status(500).json({ error: "Failed to fetch resources" }); }
});

app.post('/api/resources', requireAuth, upload.single('file'), async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const { title, description, category } = req.body;
        
        const newResource = await prisma.resource.create({
            data: {
                title, description, category,
                fileUrl: `/uploads/${req.file.filename}`,
                fileName: req.file.originalname,
                uploadedById: req.user.id
            },
            include: { uploadedBy: { select: { firstName: true, lastName: true, email: true } } }
        });
        res.status(201).json(newResource);
    } catch (error) { res.status(500).json({ error: "Upload failed" }); }
});

app.delete('/api/resources/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'Admin' && req.user.role !== 'Super_Admin') return res.status(403).json({ error: "Unauthorized" });
    try {
        await prisma.resource.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Delete failed" }); }
});

// Add this to backend/index.js
app.get('/api/my-properties', requireAuth, async (req, res) => {
    try {
        const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        let whereClause = { isActive: true };

        // If not Super Admin, compile their Primary Property + Multi-Property list
        if (currentUser.role !== 'Super_Admin') {
            let allowedProps = currentUser.propertyId ? [currentUser.propertyId] : [];
            const perms = currentUser.permissions ? JSON.parse(currentUser.permissions) : {};
            
            if (perms.multi_property && Array.isArray(perms.multi_property)) {
                allowedProps = [...new Set([...allowedProps, ...perms.multi_property])];
            }
            whereClause.id = { in: allowedProps };
        }

        const properties = await prisma.property.findMany({ 
            where: whereClause,
            select: { id: true, name: true, code: true } // Keep payload light for the header
        });
        
        res.json({ role: currentUser.role, properties });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch property filter list" });
    }
});

// ==========================================
// CURRENT USER PERMISSIONS ENDPOINT
// ==========================================
app.get('/api/users/me/permissions', requireAuth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
        if (!user) return res.status(404).json({ error: "User not found" });
        const perms = user.permissions ? JSON.parse(user.permissions) : {};
        res.json({ permissions: perms });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch permissions" });
    }
});

// ==========================================
// SERVER BOOT
// ==========================================
app.listen(PORT, () => {
    console.log(`Backend securely running on http://localhost:${PORT}`);
});