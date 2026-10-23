import { useState, useEffect, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Bell, LogOut, CheckCircle2, X, Menu, Search, Plus, Trash2, Edit, Key, Shield, User as UserIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

export default function Users() {
  const navigate = useNavigate()
  
  const [users, setUsers] = useState<any[]>([]) 
  const [properties, setProperties] = useState<any[]>([]) 
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  
  const userRole = localStorage.getItem('role') || 'User'
  const isAdmin = userRole === 'Admin' || userRole === 'Super_Admin'

  const [appSettings, setAppSettings] = useState({ companyName: "IT NextGen", logoUrl: "" })
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // --- Property Filter State ---
  const [allowedProperties, setAllowedProperties] = useState<any[]>([])
  const [activeProperty, setActiveProperty] = useState(localStorage.getItem('activeProperty') || 'All')

  // --- Add/Edit User State ---
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState("User")
  const [propertyId, setPropertyId] = useState("Global")
  
  // Only used for creating a new user
  const [password, setPassword] = useState("")

  // --- Reset Password State ---
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [resetUserId, setResetUserId] = useState<number | null>(null)
  const [newPassword, setNewPassword] = useState("")

  const prevUnreadCount = useRef<number | null>(null)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('activeProperty')
    window.location.href = '/login'
  }

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard')
      return
    }

    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    const headers = { 'Authorization': `Bearer ${token}` }

    fetch('/api/settings', { headers }).then(res => res.json()).then(data => setAppSettings(data))
    
    // Fetch full properties list for the assignment dropdown inside the modal
    fetch('/api/properties', { headers }).then(res => res.json()).then(data => setProperties(data))

    // Fetch Allowed Properties for Context Switcher
    fetch('/api/my-properties', { headers })
      .then(res => res.json())
      .then(data => {
        setAllowedProperties(data.properties)
        // Force non-Super Admins out of 'All' view if they happen to have it stored
        if (data.role !== 'Super_Admin' && activeProperty === 'All') {
          const defaultProp = data.properties.length > 0 ? data.properties[0].id.toString() : ""
          setActiveProperty(defaultProp)
          localStorage.setItem('activeProperty', defaultProp)
        }
      })

    const fetchUsers = async () => {
      try {
        const response = await fetch(`/api/users?propertyFilter=${activeProperty}`, { headers })
        if (response.status === 401 || response.status === 403) return handleLogout()
        if (response.ok) setUsers(await response.json())
      } catch (error) {
        console.error("Failed to fetch users")
      } finally {
        setLoading(false) 
      }
    }

    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/notifications', { headers })
        if (response.ok) {
          const data = await response.json()
          const currentUnread = data.filter((n: any) => !n.isRead).length
          
          if (prevUnreadCount.current !== null && currentUnread > prevUnreadCount.current) {
            const audio = new Audio('/notification.mp3')
            audio.play().catch(err => console.log("Autoplay policy blocked audio:", err))
          }
          
          prevUnreadCount.current = currentUnread
          setNotifications(data)
        }
      } catch (error) { console.error("Failed to fetch notifications") }
    }

    fetchUsers()
    fetchNotifications()
    const intervalId = setInterval(fetchNotifications, 15000)
    return () => clearInterval(intervalId)
  }, [navigate, isAdmin, activeProperty]) // Re-run when context switches

  const handleContextSwitch = (val: string) => {
    setActiveProperty(val)
    localStorage.setItem('activeProperty', val)
    window.location.reload()
  }

  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n))
    } catch (error) { console.error("Failed to mark read") }
  }

  const clearNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation() 
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications(notifications.filter((n: any) => n.id !== id))
    } catch (error) { console.error("Failed to clear notification") }
  }

  const clearAllNotifications = async () => {
    try {
      await fetch(`/api/notifications`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications([])
    } catch (error) { console.error("Failed to clear notifications") }
  }

  // --- CRUD ACTIONS ---
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const payload = {
      firstName, lastName, email, phone, role,
      propertyId: propertyId === "Global" ? null : propertyId,
      ...( !editId && { password } ) // Only include password if creating new user
    }

    try {
      const url = editId ? `/api/users/${editId}` : '/api/users'
      const method = editId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const savedUser = await response.json()
        if (editId) {
          setUsers(users.map(u => u.id === editId ? savedUser : u))
        } else {
          // Add to list only if the new user matches the active context filter
          if (activeProperty === 'All' || savedUser.propertyId?.toString() === activeProperty) {
            setUsers([savedUser, ...users])
          }
        }
        setIsModalOpen(false)
        resetForm()
      } else {
        alert("Failed to save user. Email might already exist.")
      }
    } catch (error) { alert("Network Error") }
  }

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) setUsers(users.filter(u => u.id !== id))
      else alert("Cannot delete user. Reassign their tickets and projects first.")
    } catch (error) { alert("Error deleting user") }
  }

  // --- PASSWORD RESET ACTIONS ---
  const openResetModal = (id: number) => {
    setResetUserId(id)
    setNewPassword("")
    setIsResetOpen(true)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || !resetUserId) return

    try {
      const response = await fetch(`/api/users/${resetUserId}/reset-password`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ password: newPassword })
      })

      if (response.ok) {
        alert("Password updated successfully.")
        setIsResetOpen(false)
        setNewPassword("")
        setResetUserId(null)
      } else {
        alert("Failed to reset password.")
      }
    } catch (error) {
      alert("Network Error")
    }
  }

  const openEditModal = (user: any) => {
    setEditId(user.id)
    setFirstName(user.firstName || "")
    setLastName(user.lastName || "")
    setEmail(user.email)
    setPhone(user.phone || "")
    setRole(user.role)
    setPropertyId(user.propertyId ? user.propertyId.toString() : "Global")
    setIsModalOpen(true)
  }

  const resetForm = () => {
    setEditId(null); 
    setFirstName(""); 
    setLastName(""); 
    setEmail(""); 
    setPhone(""); 
    setRole("User"); 
    
    // Default assignment to the currently active property context
    if (userRole === 'Super_Admin' && activeProperty === 'All') {
      setPropertyId('Global')
    } else if (activeProperty !== 'All') {
      setPropertyId(activeProperty)
    } else {
      setPropertyId(properties.length > 0 ? properties[0].id.toString() : "")
    }

    setPassword("");
  }

  const filteredUsers = users.filter(u => {
    const searchString = `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''}`.toLowerCase();
    return searchString.includes(searchQuery.toLowerCase());
  });

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
              <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className={`block mt-6 pt-4 border-t border-slate-700 ${window.location.pathname.includes('/settings') ? 'text-amber-400 font-bold' : 'text-amber-500 font-medium hover:text-amber-400'}`}>Super Admin Console</Link>
            )}

            {/* Mobile Logout */}
            <button onClick={handleLogout} className="md:hidden flex items-center text-red-400 hover:text-red-300 mt-6 pt-4 border-t border-slate-700 w-full text-left font-medium">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </button>
          </nav>
        </aside>

        {/* MOBILE-OPTIMIZED MAIN CONTENT */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden w-full">
          <header className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">User Management</h1>
              <p className="text-xs md:text-sm text-slate-500">Create accounts, assign roles, and route users to properties.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search staff..." 
                  className="pl-10 bg-white text-sm md:text-base h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-slate-900 text-white hover:bg-slate-800 w-full sm:w-auto h-10">
                <Plus className="w-4 h-4 mr-2" /> Add User
              </Button>
            </div>
          </header>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-full">
            {loading ? <div className="p-8 md:p-12 text-center text-sm md:text-base text-slate-500">Loading users...</div> : (
              // MOBILE TABLE WRAPPER
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[800px] w-full">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>System Role</TableHead>
                      <TableHead>Property Assignment</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 md:py-12 text-slate-500 text-xs md:text-sm">No users found matching your search in this context.</TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-bold text-slate-800 text-xs md:text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                                {user.firstName ? user.firstName.charAt(0) : <UserIcon className="w-4 h-4" />}
                              </div>
                              {user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600 text-xs md:text-sm space-y-1">
                            <div>{user.email}</div>
                            {user.phone && <div className="text-[10px] md:text-xs text-slate-400">{user.phone}</div>}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap flex items-center w-fit gap-1 ${
                              user.role === 'Super_Admin' ? 'bg-amber-100 text-amber-700' : 
                              user.role === 'Admin' ? 'bg-indigo-100 text-indigo-700' : 
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {(user.role === 'Super_Admin' || user.role === 'Admin') && <Shield className="w-3 h-3" />}
                              {user.role.replace('_', ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs md:text-sm whitespace-nowrap font-medium text-slate-700">
                            {user.property ? user.property.name : "Global / Corporate"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            
                            <Button variant="ghost" size="sm" onClick={() => openResetModal(user.id)} className="text-amber-600 p-1 md:p-2" title="Reset Password">
                              <Key className="w-4 h-4" />
                            </Button>
                            
                            <Button variant="ghost" size="sm" onClick={() => openEditModal(user)} className="text-blue-600 p-1 md:p-2 ml-1" title="Edit User">
                              <Edit className="w-4 h-4" />
                            </Button>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-600 ml-1 p-1 md:p-2" title="Delete User">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="w-[90vw] max-w-[400px] bg-white rounded-xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User Account?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-xs md:text-sm">This action cannot be undone. Make sure their open tickets are reassigned first.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="mt-4">
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(user.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* CREATE / EDIT USER MODAL */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if(!open) resetForm(); }}>
        <DialogContent className="w-[90vw] max-w-[450px] bg-white p-4 md:p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Update Staff Member" : "Create Staff Account"}</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">Define their basic profile and access level.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveUser} className="space-y-4 mt-2 md:mt-4 max-h-[75vh] overflow-y-auto pr-1">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>First Name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Last Name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email Address *</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label>Phone Number</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </div>

            {!editId && (
              <div className="space-y-2">
                <Label>Temporary Password *</Label>
                <Input type="text" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Must be at least 6 characters" />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>System Role *</Label>
                <Select required value={role} onValueChange={setRole}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="User">Standard User</SelectItem>
                    <SelectItem value="Admin">IT Admin</SelectItem>
                    {userRole === 'Super_Admin' && <SelectItem value="Super_Admin">Super Admin</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Property Assignment *</Label>
                <Select required value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {userRole === 'Super_Admin' && <SelectItem value="Global">Global / Corporate</SelectItem>}
                    {properties.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" className="w-full bg-slate-900 text-white mt-2 md:mt-4">{editId ? "Save Changes" : "Create Account"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* RESET PASSWORD MODAL */}
      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] bg-white p-4 md:p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">Assign a new temporary password for this user.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>New Password *</Label>
              <Input 
                type="text" 
                required 
                placeholder="Enter new password..." 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
              />
            </div>
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white mt-2">Update Password</Button>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}