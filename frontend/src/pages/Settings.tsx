import { useState, useEffect, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Bell, LogOut, CheckCircle2, X, Plus, Trash2, Edit, Building, Shield, FileText, Download, LayoutDashboard, Menu, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import * as XLSX from "xlsx"

export default function Settings() {
  const navigate = useNavigate()
  const userRole = localStorage.getItem('role') || 'User'
  const isAdmin = userRole === 'Admin' || userRole === 'Super_Admin'
  
  // --- CORE STATE ---
  const [activeTab, setActiveTab] = useState<"branding" | "properties" | "permissions" | "audit" | "email">("branding")
  const [appSettings, setAppSettings] = useState({ companyName: "IT NextGen", logoUrl: "" })
  const [properties, setProperties] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  // --- PROPERTY FILTER STATE ---
  const [allowedProperties, setAllowedProperties] = useState<any[]>([])
  const [activeProperty, setActiveProperty] = useState(localStorage.getItem('activeProperty') || 'All')

  // --- BRANDING STATE ---
  const [companyName, setCompanyName] = useState("")
  const [logoFile, setLogoFile] = useState<File | null>(null)

  // --- PROPERTY STATE ---
  const [isPropOpen, setIsPropOpen] = useState(false)
  const [propData, setPropData] = useState({ id: null, name: "", code: "", address: "", landphone: "", location: "", facebook: "", instagram: "", youtube: "", linkedin: "", threads: "", website: "" })

  // --- PERMISSIONS STATE ---
  const [isPermOpen, setIsPermOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [userPermissions, setUserPermissions] = useState<Record<string, any>>({}) // Updated to "any" to support arrays

  // --- AUDIT STATE ---
  const [isDownloading, setIsDownloading] = useState(false)

  // --- EMAIL SETTINGS STATE ---
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [emailConfigs, setEmailConfigs] = useState<any[]>([])
  const [emailForm, setEmailForm] = useState({ provider: "", type: "IMAP", host: "", port: "993", user: "", password: "" })

  const prevUnreadCount = useRef<number | null>(null)

  useEffect(() => {
    if (userRole !== 'Super_Admin') {
      navigate('/dashboard')
      return 
    }

    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return 
    }

    const headers = { 'Authorization': `Bearer ${token}` }

    // Fetch Allowed Properties for Context Switcher
    fetch('/api/my-properties', { headers })
      .then(res => res.json())
      .then(data => {
        setAllowedProperties(data.properties || [])
        if (data.role !== 'Super_Admin' && activeProperty === 'All') {
          const defaultProp = data.properties.length > 0 ? data.properties[0].id.toString() : ""
          setActiveProperty(defaultProp)
          localStorage.setItem('activeProperty', defaultProp)
        }
      })

    const fetchAll = async () => {
      fetch('/api/settings', { headers }).then(res => res.json()).then(data => {
        setAppSettings(data)
        setCompanyName(data.companyName || "")
      })
      fetch('/api/properties', { headers }).then(res => res.json()).then(data => setProperties(data))
      fetch('/api/users', { headers }).then(res => res.json()).then(data => setUsers(data))
      
      // Fetch Email Configs
      fetch('/api/email-settings', { headers })
        .then(res => res.ok ? res.json() : [])
        .then(data => setEmailConfigs(data))
        .catch(err => console.error("Email configs not found yet", err))
    }

    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/notifications', { headers })
        if (response.ok) {
          const data = await response.json()
          const currentUnread = data.filter((n: any) => !n.isRead).length
          if (prevUnreadCount.current !== null && currentUnread > prevUnreadCount.current) {
            new Audio('/notification.mp3').play().catch(e => console.log(e))
          }
          prevUnreadCount.current = currentUnread
          setNotifications(data)
        }
      } catch (error) { console.error(error) }
    }

    fetchAll()
    fetchNotifications()
    const intervalId = setInterval(fetchNotifications, 15000)
    return () => clearInterval(intervalId)
  }, [navigate, userRole, activeProperty])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('activeProperty')
    window.location.href = '/login'
  }

  const handleContextSwitch = (val: string) => {
    setActiveProperty(val)
    localStorage.setItem('activeProperty', val)
    window.location.reload()
  }

  // --- NOTIFICATION ACTIONS ---
  const markAsRead = async (id: number) => {
    fetch(`/api/notifications/${id}/read`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n))
  }
  const clearNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation() 
    fetch(`/api/notifications/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    setNotifications(notifications.filter((n: any) => n.id !== id))
  }
  const clearAllNotifications = async () => {
    fetch(`/api/notifications`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    setNotifications([])
  }

  // --- BRANDING ACTIONS ---
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.append("companyName", companyName)
    if (logoFile) formData.append("logo", logoFile)

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      })
      if (response.ok) {
        const updated = await response.json()
        setAppSettings(updated)
        alert("Branding settings saved successfully!")
      }
    } catch (error) { 
      console.error(error)
      alert("Failed to save settings") 
    }
  }

  // --- PROPERTY ACTIONS ---
  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const method = propData.id ? 'PUT' : 'POST'
      const url = propData.id ? `/api/properties/${propData.id}` : '/api/properties'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(propData)
      })
      if (response.ok) {
        const savedProp = await response.json()
        if (propData.id) setProperties(properties.map(p => p.id === propData.id ? savedProp : p))
        else setProperties([...properties, savedProp])
        setIsPropOpen(false)
      }
    } catch (error) { 
      console.error(error)
      alert("Network error") 
    }
  }

  const handleDeleteProperty = async (id: number) => {
    try {
      const response = await fetch(`/api/properties/${id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) setProperties(properties.filter(p => p.id !== id))
      else alert("Cannot delete property. It is currently linked to existing users or assets.")
    } catch (error) { 
      console.error(error)
      alert("Error deleting property") 
    }
  }

  // --- PERMISSIONS ACTIONS (UPDATED WITH QUOTES) ---
  const defaultPermissions = {
    view_all_tickets: false, create_tickets: true, edit_tickets: false, delete_tickets: false,
    view_all_projects: false, create_projects: false, edit_projects: false, delete_projects: false,
    add_quotes: false, edit_quotes: false, delete_quotes: false,
    view_amc: false, manage_amc: false,
    execute_checklists: true, manage_templates: false,
    view_resources: true, upload_resources: false, delete_resources: false,
    multi_property: [] 
  }

  const openPermissionsModal = (user: any) => {
    setSelectedUser(user)
    const currentPerms = user.permissions && user.permissions !== "{}" 
        ? JSON.parse(user.permissions) 
        : defaultPermissions
    setUserPermissions(currentPerms)
    setIsPermOpen(true)
  }

  const handlePropertyToggle = (propId: number) => {
    const current = userPermissions.multi_property || [];
    if (current.includes(propId)) {
        setUserPermissions({ ...userPermissions, multi_property: current.filter((id: number) => id !== propId) });
    } else {
        setUserPermissions({ ...userPermissions, multi_property: [...current, propId] });
    }
  }

  const handleSavePermissions = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/users/${selectedUser.id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ permissions: userPermissions })
      })
      if (response.ok) {
        const updatedUser = await response.json()
        setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u))
        setIsPermOpen(false)
      }
    } catch (error) { 
      console.error(error)
      alert("Failed to save permissions") 
    }
  }

  // --- AUDIT LOGS ACTIONS ---
  const downloadAuditLog = async () => {
    setIsDownloading(true)
    try {
      const response = await fetch('/api/audit', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      const data = await response.json()

      const exportData = data.map((log: any) => ({
        "Date & Time": new Date(log.date).toLocaleString(),
        "User Email": log.user,
        "Module": log.module,
        "Action Performed": log.action,
        "Details": log.details
      }))

      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "System Audit Trail")
      XLSX.writeFile(workbook, `Audit_Log_${new Date().getTime()}.xlsx`)
    } catch (error) {
      console.error(error)
      alert("Failed to download audit log.")
    } finally {
      setIsDownloading(false)
    }
  }

  // --- EMAIL CONFIGURATIONS ACTIONS ---
  const handleSaveEmailConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const newConfig = { id: Date.now(), ...emailForm }
      setEmailConfigs([...emailConfigs, newConfig])
      setIsEmailModalOpen(false)
    } catch (error) { 
      console.error(error)
      alert("Failed to save email configuration") 
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      
      {/* MOBILE-OPTIMIZED TOP RIBBON */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 md:px-6 shrink-0 shadow-md relative z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-300 hover:text-white focus:outline-none">
            <Menu className="w-6 h-6" />
          </button>
          
          {appSettings.logoUrl && <img src={`${appSettings.logoUrl}`} alt="Logo" className="h-8 md:h-10 w-auto bg-white/10 rounded p-1 object-contain hidden sm:block" />}
          <h1 className="text-lg md:text-xl font-bold tracking-tight truncate max-w-[140px] md:max-w-none">{appSettings.companyName}</h1>
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          
          {/* PROPERTY CONTEXT SWITCHER */}
          {(isAdmin || userRole === 'Super_Admin') && (
            <div className="hidden sm:block mr-2 md:mr-4">
              <Select value={activeProperty} onValueChange={handleContextSwitch}>
                <SelectTrigger className="w-[160px] md:w-[200px] h-9 bg-slate-800 border-slate-700 text-slate-200 focus:ring-indigo-500">
                  <SelectValue placeholder="Select Property Context" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {userRole === 'Super_Admin' && (
                    <SelectItem value="All" className="font-bold text-slate-800 border-b border-slate-100">
                      Globally (All Properties)
                    </SelectItem>
                  )}
                  {allowedProperties.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name} <span className="text-slate-400 text-xs ml-2">({p.code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="relative">
            <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="relative p-2 hover:bg-slate-800 rounded-full transition-colors focus:outline-none">
              <Bell className="w-5 h-5 text-slate-300" />
              {unreadCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center border-2 border-slate-900">{unreadCount}</span>}
            </button>

            {isNotifOpen && (
              <div className="absolute right-[-40px] md:right-0 mt-3 w-[300px] md:w-80 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden text-slate-800 z-50">
                <div className="p-3 md:p-4 bg-slate-50 border-b border-slate-100 font-semibold flex justify-between items-center">
                  <span className="text-sm md:text-base">Notifications <span className="text-xs font-normal text-slate-500 ml-1">({unreadCount})</span></span>
                  {notifications.length > 0 && (
                    <button onClick={clearAllNotifications} className="text-[10px] text-red-600 hover:text-red-800 font-bold uppercase tracking-wider">
                      Clear All
                    </button>
                  )}
                </div>
                <div className="max-h-[60vh] md:max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-sm text-slate-500 text-center">You have no notifications.</div>
                  ) : (
                    notifications.map((n: any) => (
                      <div key={n.id} onClick={() => markAsRead(n.id)} className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${!n.isRead ? 'bg-blue-50/30' : ''}`}>
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-sm pr-2 ${!n.isRead ? 'font-bold text-blue-900' : 'font-medium text-slate-700'}`}>{n.title}</h4>
                          <div className="flex items-center gap-2 shrink-0">
                            {!n.isRead ? <span className="h-2 w-2 bg-blue-600 rounded-full mt-0.5"></span> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                            <button onClick={(e) => clearNotification(e, n.id)} className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded transition-colors"><X className="w-3 h-3" /></button>
                          </div>
                        </div>
                        {n.description && <p className={`text-xs ${!n.isRead ? 'text-slate-700' : 'text-slate-500'} mb-2`}>{n.description}</p>}
                        {n.dueDate && <div className="text-[10px] font-semibold text-amber-700 bg-amber-100 inline-block px-2 py-1 rounded">Due: {new Date(n.dueDate).toLocaleString()}</div>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 h-9 hidden md:flex">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </header>

      {/* APP BODY */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* MOBILE OVERLAY BACKDROP */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
        )}

        {/* RESPONSIVE OFF-CANVAS SIDEBAR */}
        <aside className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-50 w-64 h-[calc(100vh-4rem)] md:h-auto bg-slate-800 text-white p-6 flex flex-col transition-transform duration-300 ease-in-out`}>
          <div className="flex justify-between items-center md:hidden mb-6 pb-4 border-b border-slate-700">
            <span className="font-bold tracking-wider text-slate-300">MENU</span>
            <button className="text-slate-400 hover:text-white focus:outline-none" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* MOBILE CONTEXT SWITCHER */}
          {(isAdmin || userRole === 'Super_Admin') && (
            <div className="md:hidden mb-6">
              <Label className="text-xs text-slate-400 mb-2 block">Property Filter</Label>
              <Select value={activeProperty} onValueChange={handleContextSwitch}>
                <SelectTrigger className="w-full h-10 bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Select Property Context" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {userRole === 'Super_Admin' && <SelectItem value="All" className="font-bold text-slate-800">Globally (All Properties)</SelectItem>}
                  {allowedProperties.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <nav className="space-y-4 overflow-y-auto flex-1">
            <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/dashboard') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Dashboard</Link>
            <Link to="/tickets" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/tickets') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Tickets</Link>
            <Link to="/projects" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/projects') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Projects</Link>
            <Link to="/checklists" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/checklists') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Routine Checklists</Link>
            <Link to="/resources" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/resources') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Resource Hub</Link>
            <Link to="/hotels" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/hotels') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Hotel Details</Link>
            <Link to="/contacts" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/contacts') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Directory</Link>
            
            {(userRole === 'Admin' || userRole === 'Super_Admin') && (
              <>
                <Link to="/users" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/users') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>User Management</Link>
                <Link to="/amc" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/amc') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>AMC & Licenses</Link>
                <Link to="/reports" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/reports') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Reports & Exports</Link>
              </>
            )}
            
            {userRole === 'Super_Admin' && (
              <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className={`block mt-6 pt-4 border-t border-slate-700 text-amber-400 font-bold`}>Super Admin Console</Link>
            )}

            <button onClick={handleLogout} className="md:hidden flex items-center text-red-400 hover:text-red-300 mt-6 pt-4 border-t border-slate-700 w-full text-left font-medium">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </button>
          </nav>
        </aside>

        {/* MOBILE-OPTIMIZED MAIN CONTENT */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden w-full">
          <header className="mb-6 md:mb-8">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2"><Shield className="w-5 h-5 md:w-6 md:h-6 text-amber-500" /> Super Admin Console</h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">Manage global system configurations, properties, permissions, and audit logs.</p>
          </header>

          {/* MOBILE SCROLLABLE TABS */}
          <div className="flex overflow-x-auto whitespace-nowrap border-b border-slate-200 mb-6 md:mb-8 pb-1 md:pb-0 [&::-webkit-scrollbar]:hidden">
            <button onClick={() => setActiveTab("branding")} className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-bold transition-colors shrink-0 ${activeTab === "branding" ? 'bg-white text-indigo-700 border-b-2 border-indigo-600' : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-700'}`}><LayoutDashboard className="w-4 h-4"/> Branding</button>
            <button onClick={() => setActiveTab("properties")} className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-bold transition-colors shrink-0 ${activeTab === "properties" ? 'bg-white text-indigo-700 border-b-2 border-indigo-600' : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-700'}`}><Building className="w-4 h-4"/> Properties</button>
            <button onClick={() => setActiveTab("permissions")} className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-bold transition-colors shrink-0 ${activeTab === "permissions" ? 'bg-white text-indigo-700 border-b-2 border-indigo-600' : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-700'}`}><Shield className="w-4 h-4"/> Permissions</button>
            <button onClick={() => setActiveTab("audit")} className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-bold transition-colors shrink-0 ${activeTab === "audit" ? 'bg-white text-indigo-700 border-b-2 border-indigo-600' : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-700'}`}><FileText className="w-4 h-4"/> Audit Logs</button>
            <button onClick={() => setActiveTab("email")} className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-bold transition-colors shrink-0 ${activeTab === "email" ? 'bg-white text-indigo-700 border-b-2 border-indigo-600' : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-700'}`}><Mail className="w-4 h-4"/> Email Settings</button>
          </div>

          {/* TAB: BRANDING */}
          {activeTab === "branding" && (
            <Card className="max-w-2xl bg-white shadow-sm border-slate-200">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-4 md:p-6">
                <CardTitle className="text-base md:text-lg">Tenant Customization</CardTitle>
                <CardDescription className="text-xs md:text-sm mt-1">Update the master company name and logo displayed across the app.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <form onSubmit={handleSaveBranding} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label>Navigation Logo (Optional)</Label>
                    <Input type="file" onChange={(e: any) => setLogoFile(e.target.files ? e.target.files[0] : null)} className="text-xs md:text-sm file:mr-4 file:py-1.5 md:file:py-2 file:px-3 md:file:px-4 file:rounded-md file:border-0 file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                  </div>
                  <Button type="submit" className="w-full sm:w-auto bg-slate-900 text-white hover:bg-slate-800 mt-2">Save Configuration</Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* TAB: PROPERTIES */}
          {activeTab === "properties" && (
            <div>
              <div className="flex justify-end mb-4">
                <Button onClick={() => { setPropData({ id: null, name: "", code: "", address: "", landphone: "", location: "", facebook: "", instagram: "", youtube: "", linkedin: "", threads: "", website: "" }); setIsPropOpen(true); }} className="w-full sm:w-auto bg-slate-900 text-white h-10"><Plus className="w-4 h-4 mr-2" /> Add Property</Button>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-full">
                <div className="overflow-x-auto w-full">
                  <Table className="min-w-[600px] w-full">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Property Name</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {properties.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-bold text-slate-800 text-xs md:text-sm">{p.code}</TableCell>
                          <TableCell className="font-medium text-xs md:text-sm">{p.name}</TableCell>
                          <TableCell className="text-slate-500 truncate max-w-[150px] md:max-w-[200px] text-xs md:text-sm">{p.address}</TableCell>
                          <TableCell className="text-xs md:text-sm">{p.landphone}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button variant="ghost" size="sm" onClick={() => { setPropData(p); setIsPropOpen(true); }} className="text-blue-600 p-1 md:p-2"><Edit className="w-4 h-4"/></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteProperty(p.id)} className="text-red-600 ml-1 md:ml-2 p-1 md:p-2"><Trash2 className="w-4 h-4"/></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {properties.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500 text-xs md:text-sm">No properties defined yet.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PERMISSIONS */}
          {activeTab === "permissions" && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-full">
              <div className="p-3 md:p-4 bg-slate-50 border-b border-slate-100">
                <p className="text-xs md:text-sm font-semibold text-slate-700">Manage fine-grained feature access for individual users.</p>
              </div>
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[500px] w-full">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Staff Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.filter(u => u.role !== 'Super_Admin').map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-bold text-slate-800 text-xs md:text-sm whitespace-nowrap">{u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : "—"}</TableCell>
                        <TableCell className="text-slate-600 text-xs md:text-sm">{u.email}</TableCell>
                        <TableCell><span className="px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold bg-slate-100 whitespace-nowrap">{u.role.replace('_', ' ')}</span></TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button variant="outline" size="sm" onClick={() => openPermissionsModal(u)} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-[10px] md:text-xs"><Shield className="w-3 h-3 mr-1.5"/> Manage</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* TAB: AUDIT LOGS */}
          {activeTab === "audit" && (
            <Card className="max-w-xl bg-white shadow-sm border-slate-200">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-4 md:p-6">
                <CardTitle className="text-base md:text-lg">System Audit Trail</CardTitle>
                <CardDescription className="text-xs md:text-sm mt-1">Export a chronological log of all major actions performed across the system.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 text-xs md:text-sm text-slate-500">Includes ticket creations, project milestones, checklist submissions, user registrations, and resource uploads.</div>
                  <Button onClick={downloadAuditLog} disabled={isDownloading} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
                    <Download className="w-4 h-4 mr-2"/> {isDownloading ? "Generating..." : "Download Excel (.xlsx)"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB: EMAIL INTEGRATIONS */}
          {activeTab === "email" && (
            <div>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Inbound Email Routing</h2>
                  <p className="text-sm text-slate-500">Configure IMAP polling or Webhooks to auto-create tickets from emails.</p>
                </div>
                <Button onClick={() => { setEmailForm({ provider: "", type: "IMAP", host: "", port: "993", user: "", password: "" }); setIsEmailModalOpen(true); }} className="w-full sm:w-auto bg-slate-900 text-white"><Plus className="w-4 h-4 mr-2" /> Add Configuration</Button>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-full">
                <div className="overflow-x-auto w-full">
                  <Table className="min-w-[700px] w-full">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Account / Provider</TableHead>
                        <TableHead>Connection Type</TableHead>
                        <TableHead>Host Details</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailConfigs.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500 text-xs md:text-sm">No email integrations configured.</TableCell></TableRow>
                      ) : (
                        emailConfigs.map(conf => (
                          <TableRow key={conf.id}>
                            <TableCell className="font-bold text-slate-800 text-xs md:text-sm">{conf.user}</TableCell>
                            <TableCell><span className="px-2 py-1 rounded-md text-[10px] md:text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">{conf.type}</span></TableCell>
                            <TableCell className="text-xs md:text-sm text-slate-600">{conf.type === 'IMAP' ? `${conf.host}:${conf.port}` : 'Webhook Endpoint Active'}</TableCell>
                            <TableCell><span className="px-2 py-1 rounded-full text-[10px] md:text-xs font-bold bg-emerald-100 text-emerald-700 whitespace-nowrap">Listening</span></TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="text-red-600 p-1 md:p-2"><Trash2 className="w-4 h-4"/></Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* PROPERTY MODAL */}
      <Dialog open={isPropOpen} onOpenChange={(open) => { setIsPropOpen(open); if(!open) setPropData({ id: null, name: "", code: "", address: "", landphone: "", location: "", facebook: "", instagram: "", youtube: "", linkedin: "", threads: "", website: "" }); }}>
        <DialogContent className="w-[90vw] max-w-[500px] bg-white p-4 md:p-6 rounded-xl">
          <DialogHeader><DialogTitle>{propData.id ? 'Edit Property' : 'Add Property'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveProperty} className="space-y-4 mt-2 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Property Name *</Label><Input required value={propData.name} onChange={(e) => setPropData({...propData, name: e.target.value})} /></div>
              <div className="space-y-2"><Label>Short Code *</Label><Input required value={propData.code} onChange={(e) => setPropData({...propData, code: e.target.value})} placeholder="e.g. BLR" /></div>
            </div>
            
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea value={propData.address} onChange={(e: any) => setPropData({...propData, address: e.target.value})} className="h-20" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><Input value={propData.landphone} onChange={(e) => setPropData({...propData, landphone: e.target.value})} /></div>
              <div className="space-y-2"><Label>Location/City</Label><Input value={propData.location} onChange={(e) => setPropData({...propData, location: e.target.value})} /></div>
            </div>
            <Button type="submit" className="w-full bg-slate-900 text-white mt-4">Save Property</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* PERMISSIONS MODAL */}
      <Dialog open={isPermOpen} onOpenChange={setIsPermOpen}>
        <DialogContent className="w-[90vw] max-w-[600px] bg-white p-4 md:p-6 rounded-xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Feature Access</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">Modify what <strong>{selectedUser?.email}</strong> can access.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSavePermissions} className="flex-1 overflow-y-auto pr-2 mt-4 space-y-4 md:space-y-6">

            {/* MULTI-PROPERTY ACCESS BLOCK */}
            <div className="space-y-2 md:space-y-3">
              <h4 className="text-xs md:text-sm font-bold text-slate-800 border-b border-slate-200 pb-1">Property Visibility (Multi-Property Access)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                {properties.map(p => (
                  <Label key={p.id} className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 text-xs md:text-sm">
                    <input 
                       type="checkbox" 
                       checked={(userPermissions.multi_property || []).includes(p.id)} 
                       onChange={() => handlePropertyToggle(p.id)} 
                       className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-600 shrink-0"
                    />
                    <span className="truncate">{p.name}</span>
                  </Label>
                ))}
              </div>
            </div>
            
            {/* Tickets */}
            <div className="space-y-2 md:space-y-3">
              <h4 className="text-xs md:text-sm font-bold text-slate-800 border-b border-slate-200 pb-1">Ticket Module</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                {['view_all_tickets', 'create_tickets', 'edit_tickets', 'delete_tickets'].map(perm => (
                  <Label key={perm} className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 text-xs md:text-sm">
                    <input type="checkbox" checked={userPermissions[perm] || false} onChange={(e) => setUserPermissions({...userPermissions, [perm]: e.target.checked})} className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-600 shrink-0"/>
                    <span className="truncate">{perm.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
                  </Label>
                ))}
              </div>
            </div>

            {/* Projects & Quotes */}
            <div className="space-y-2 md:space-y-3">
              <h4 className="text-xs md:text-sm font-bold text-slate-800 border-b border-slate-200 pb-1">Project & Quotes Module</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                {['view_all_projects', 'create_projects', 'edit_projects', 'delete_projects', 'add_quotes', 'edit_quotes', 'delete_quotes'].map(perm => (
                  <Label key={perm} className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 text-xs md:text-sm">
                    <input type="checkbox" checked={userPermissions[perm] || false} onChange={(e) => setUserPermissions({...userPermissions, [perm]: e.target.checked})} className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-600 shrink-0"/>
                    <span className="truncate">{perm.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
                  </Label>
                ))}
              </div>
            </div>

            {/* Checklists & Resources */}
            <div className="space-y-2 md:space-y-3">
              <h4 className="text-xs md:text-sm font-bold text-slate-800 border-b border-slate-200 pb-1">Operations Modules</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                {['execute_checklists', 'manage_templates', 'view_resources', 'upload_resources', 'delete_resources', 'view_amc', 'manage_amc'].map(perm => (
                  <Label key={perm} className="flex items-center gap-2 cursor-pointer font-medium text-slate-600 text-xs md:text-sm">
                    <input type="checkbox" checked={userPermissions[perm] || false} onChange={(e) => setUserPermissions({...userPermissions, [perm]: e.target.checked})} className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-600 shrink-0"/>
                    <span className="truncate">{perm.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
                  </Label>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-4">Save Permissions</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* EMAIL CONFIG MODAL */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="w-[90vw] max-w-[450px] bg-white p-4 md:p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle>Configure Inbound Email</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">Type an email address or provider (e.g., SendGrid) to auto-detect settings.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEmailConfig} className="space-y-4 mt-4">
            
            <div className="space-y-2">
              <Label>Email Address / Provider Name *</Label>
              <Input 
                required 
                placeholder="support@gmail.com or SendGrid" 
                value={emailForm.provider} 
                onChange={(e) => {
                  const val = e.target.value;
                  // Auto-Detect Logic execution
                  if (val.includes('@gmail.com')) {
                    setEmailForm({ ...emailForm, provider: val, user: val, type: "IMAP", host: "imap.gmail.com", port: "993" });
                  } else if (val.toLowerCase().includes('sendgrid')) {
                    setEmailForm({ ...emailForm, provider: val, type: "Webhook", host: "N/A", port: "N/A" });
                  } else {
                    setEmailForm({ ...emailForm, provider: val, user: val });
                  }
                }} 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Connection Type</Label>
                <Select value={emailForm.type} onValueChange={(val) => setEmailForm({...emailForm, type: val})}>
                  <SelectTrigger className="bg-slate-50"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="IMAP">IMAP (Pull)</SelectItem>
                    <SelectItem value="Webhook">Webhook (Push)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {emailForm.type === 'IMAP' && (
                <div className="space-y-2"><Label>Port</Label><Input value={emailForm.port} onChange={(e) => setEmailForm({...emailForm, port: e.target.value})} /></div>
              )}
            </div>

            {emailForm.type === 'IMAP' ? (
              <>
                <div className="space-y-2"><Label>IMAP Host</Label><Input value={emailForm.host} onChange={(e) => setEmailForm({...emailForm, host: e.target.value})} /></div>
                <div className="space-y-2"><Label>App Password / Token</Label><Input type="password" required value={emailForm.password} onChange={(e) => setEmailForm({...emailForm, password: e.target.value})} /></div>
              </>
            ) : (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800 break-all">
                <strong>Webhook URL Generated:</strong><br/>
                <code>https://yourdomain.com/api/webhooks/inbound-email</code><br/><br/>
                Point your provider's inbound parse route to this URL.
              </div>
            )}

            <Button type="submit" className="w-full bg-slate-900 text-white mt-4">Save Configuration</Button>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}