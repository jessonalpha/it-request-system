import { useState, useEffect, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Bell, LogOut, CheckCircle2, X, Menu, Search, Plus, Trash2, Edit, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

export default function AMC() {
  const navigate = useNavigate()
  
  const [amcs, setAmcs] = useState<any[]>([]) 
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  
  const userRole = localStorage.getItem('role') || 'User'
  const isAdmin = userRole === 'Admin' || userRole === 'Super_Admin'

  const [appSettings, setAppSettings] = useState({ companyName: "IT NextGen", logoUrl: "" })
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // --- Explicit User Permissions ---
  const [myPermissions, setMyPermissions] = useState<Record<string, any>>({})

  // --- Property Filter State ---
  const [allowedProperties, setAllowedProperties] = useState<any[]>([])
  const [activeProperty, setActiveProperty] = useState(localStorage.getItem('activeProperty') || 'All')

  // --- AMC Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [vendorProduct, setVendorProduct] = useState("")
  const [type, setType] = useState("Software_License")
  const [cost, setCost] = useState("")
  const [startDate, setStartDate] = useState("") 
  const [expiryDate, setExpiryDate] = useState("")
  const [status, setStatus] = useState("Active")
  const [notes, setNotes] = useState("")
  const [propertyId, setPropertyId] = useState("Global")

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('activeProperty')
    window.location.href = '/login'
  }
  
  const prevUnreadCount = useRef<number | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    const headers = { 'Authorization': `Bearer ${token}` }
    let intervalId: any;

    const initializePage = async () => {
      try {
        // 1. Fetch Explicit Permissions to verify access
        const permRes = await fetch('/api/users/me/permissions', { headers })
        const permData = permRes.ok ? await permRes.json() : { permissions: {} }
        const perms = permData.permissions || {}
        setMyPermissions(perms)

        // Kick out users who are not Admins AND lack the 'view_amc' permission
        if (!isAdmin && !perms.view_amc) {
          navigate('/dashboard')
          return
        }

        // 2. Fetch the rest of the app data securely
        fetch('/api/settings', { headers }).then(res => res.json()).then(data => setAppSettings(data))

        const propRes = await fetch('/api/my-properties', { headers })
        if (propRes.ok) {
          const propData = await propRes.json()
          setAllowedProperties(propData.properties)
          if (propData.role !== 'Super_Admin' && activeProperty === 'All') {
            const defaultProp = propData.properties.length > 0 ? propData.properties[0].id.toString() : ""
            setActiveProperty(defaultProp)
            localStorage.setItem('activeProperty', defaultProp)
          }
        }

        const amcRes = await fetch(`/api/amcs?propertyFilter=${activeProperty}`, { headers })
        if (amcRes.status === 401 || amcRes.status === 403) return handleLogout()
        if (amcRes.ok) setAmcs(await amcRes.json())

        setLoading(false)

        // 3. Start Notification Polling
        const fetchNotifications = async () => {
          try {
            const response = await fetch('/api/notifications', { headers })
            if (response.ok) {
              const data = await response.json()
              const currentUnread = data.filter((n: any) => !n.isRead).length
              if (prevUnreadCount.current !== null && currentUnread > prevUnreadCount.current) {
                new Audio('/notification.mp3').play().catch(err => console.log(err))
              }
              prevUnreadCount.current = currentUnread
              setNotifications(data)
            }
          } catch (error) {}
        }

        fetchNotifications()
        intervalId = setInterval(fetchNotifications, 15000)

      } catch (error) {
        console.error("Failed to load page data:", error)
        setLoading(false)
      }
    }

    initializePage()

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [navigate, isAdmin, activeProperty]) 

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

  const handleSaveAmc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendorProduct || !type || !startDate || !expiryDate) return alert("Please fill out required fields.")

    const payload = { 
      vendorProduct, 
      type, 
      cost: cost ? parseFloat(cost) : 0, 
      startDate, 
      expiryDate, 
      status, 
      notes,
      propertyId: propertyId === "Global" ? null : parseInt(propertyId) 
    }

    try {
      const url = editId ? `/api/amcs/${editId}` : '/api/amcs'
      const method = editId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const savedAmc = await response.json()
        if (editId) {
          setAmcs(amcs.map(a => a.id === editId ? savedAmc : a))
        } else {
          setAmcs([savedAmc, ...amcs])
        }
        setIsModalOpen(false)
        resetForm()
      } else {
        alert("Failed to save AMC record.")
      }
    } catch (error) { alert("Network Error") }
  }

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/amcs/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) setAmcs(amcs.filter(a => a.id !== id))
    } catch (error) { alert("Error deleting record") }
  }

  const openEditModal = (amc: any) => {
    setEditId(amc.id)
    setVendorProduct(amc.vendorProduct)
    setType(amc.type)
    setCost(amc.cost ? amc.cost.toString() : "")
    setStartDate(amc.startDate ? new Date(amc.startDate).toISOString().split('T')[0] : "")
    setExpiryDate(amc.expiryDate ? new Date(amc.expiryDate).toISOString().split('T')[0] : "")
    setStatus(amc.status)
    setNotes(amc.notes || "")
    setPropertyId(amc.propertyId ? amc.propertyId.toString() : "Global")
    setIsModalOpen(true)
  }

  const resetForm = () => {
    setEditId(null)
    setVendorProduct("")
    setType("Software_License")
    setCost("")
    setStartDate("")
    setExpiryDate("")
    setStatus("Active")
    setNotes("")
    setPropertyId(userRole === 'Super_Admin' ? "Global" : (allowedProperties.length > 0 ? allowedProperties[0].id.toString() : "Global"))
  }

  const displayedAmcs = amcs.filter(a => {
    const searchString = `${a.vendorProduct || ''} ${a.type || ''}`.toLowerCase();
    return searchString.includes(searchQuery.toLowerCase());
  });

  const unreadCount = notifications.filter(n => !n.isRead).length
  const canManageAmc = isAdmin || !!myPermissions.manage_amc;

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      
      {/* MOBILE-OPTIMIZED TOP RIBBON */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 md:px-6 shrink-0 shadow-md relative z-30">
        <div className="flex items-center gap-3">
          {/* Hamburger Menu */}
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
                <SelectTrigger className="w-[160px] md:w-[200px] h-9 bg-slate-800 border-slate-700 text-slate-200 focus:ring-amber-500">
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
                    notifications.map(n => (
                      <div key={n.id} onClick={() => markAsRead(n.id)} className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${!n.isRead ? 'bg-blue-50/30' : ''}`}>
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-sm pr-2 ${!n.isRead ? 'font-bold text-blue-900' : 'font-medium text-slate-700'}`}>{n.title}</h4>
                          <div className="flex items-center gap-2 shrink-0">
                            {!n.isRead ? <span className="h-2 w-2 bg-blue-600 rounded-full mt-0.5"></span> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                            <button onClick={(e) => clearNotification(e, n.id)} className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded transition-colors"><X className="w-3 h-3" /></button>
                          </div>
                        </div>
                        {n.description && <p className={`text-xs ${!n.isRead ? 'text-slate-700' : 'text-slate-500'} mb-2`}>{n.description}</p>}
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
            
            {/* Split Sidebar Permissions to allow standard users to see AMC if permitted */}
            {isAdmin && <Link to="/users" onClick={() => setIsMobileMenuOpen(false)} className={`block text-slate-400 hover:text-slate-300`}>User Management</Link>}
            
            {(isAdmin || !!myPermissions.view_amc) && (
              <Link to="/amc" onClick={() => setIsMobileMenuOpen(false)} className={`block text-white font-medium`}>AMC & Licenses</Link>
            )}

            {isAdmin && <Link to="/reports" onClick={() => setIsMobileMenuOpen(false)} className={`block text-slate-400 hover:text-slate-300`}>Reports & Exports</Link>}
            
            {userRole === 'Super_Admin' && (
              <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className={`block mt-6 pt-4 border-t border-slate-700 ${window.location.pathname.includes('/settings') ? 'text-amber-400 font-bold' : 'text-amber-500 font-medium hover:text-amber-400'}`}>Super Admin Console</Link>
            )}

            <button onClick={handleLogout} className="md:hidden flex items-center text-red-400 hover:text-red-300 mt-6 pt-4 border-t border-slate-700 w-full text-left font-medium">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </button>
          </nav>
        </aside>

        {/* MOBILE-OPTIMIZED MAIN CONTENT */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden w-full">
          <header className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">AMC & Licenses</h1>
              <p className="text-xs md:text-sm text-slate-500">Track vendor contracts, hardware warranties, and software renewals.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search contracts..." 
                  className="pl-10 bg-white text-sm md:text-base h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {canManageAmc && (
                <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-slate-900 text-white hover:bg-slate-800 w-full sm:w-auto h-10">
                  <Plus className="w-4 h-4 mr-2" /> Add Record
                </Button>
              )}
            </div>
          </header>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-full">
            {loading ? <div className="p-8 md:p-12 text-center text-sm md:text-base text-slate-500">Loading records...</div> : (
              // MOBILE TABLE WRAPPER
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[800px] w-full">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Vendor / Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Annual Cost</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Status</TableHead>
                      {canManageAmc && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedAmcs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canManageAmc ? 6 : 5} className="text-center py-8 md:py-12 text-slate-500 text-xs md:text-sm">No AMC or license records found.</TableCell>
                      </TableRow>
                    ) : (
                      displayedAmcs.map((amc) => {
                        const isCritical = amc.status === "Expiring_Soon" || amc.status === "Expired"
                        
                        return (
                          <TableRow key={amc.id} className={isCritical ? "bg-red-50/30" : ""}>
                            <TableCell className="font-bold text-slate-800 text-xs md:text-sm">
                              {amc.vendorProduct}
                              {amc.notes && <div className="text-[10px] md:text-xs text-slate-500 font-normal mt-0.5 truncate max-w-[200px] md:max-w-xs">{amc.notes}</div>}
                            </TableCell>
                            <TableCell>
                              <span className="px-2 py-0.5 md:px-2.5 md:py-1 rounded-md text-[10px] md:text-xs font-semibold bg-slate-100 text-slate-700 whitespace-nowrap">
                                {amc.type.replace('_', ' ')}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-medium text-slate-700 text-xs md:text-sm whitespace-nowrap">
                              {amc.cost ? amc.cost.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }) : "—"}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap">
                              <span className={isCritical ? "text-red-600 font-bold" : "text-slate-600 font-medium"}>
                                {new Date(amc.expiryDate).toLocaleDateString()}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap flex items-center w-fit gap-1 ${
                                amc.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 
                                amc.status === 'Expiring_Soon' ? 'bg-amber-100 text-amber-700' : 
                                'bg-red-100 text-red-700'
                              }`}>
                                {isCritical && <AlertTriangle className="w-3 h-3" />}
                                {amc.status.replace('_', ' ')}
                              </span>
                            </TableCell>
                            
                            {canManageAmc && (
                              <TableCell className="text-right whitespace-nowrap">
                                <Button variant="ghost" size="sm" onClick={() => openEditModal(amc)} className="text-blue-600 p-1 md:p-2 text-xs md:text-sm"><Edit className="w-3 h-3 md:w-4 md:h-4" /></Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-red-600 ml-1 p-1 md:p-2"><Trash2 className="w-3 h-3 md:w-4 md:h-4" /></Button></AlertDialogTrigger>
                                  <AlertDialogContent className="w-[90vw] max-w-[400px] bg-white rounded-xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete AMC Record?</AlertDialogTitle>
                                      <AlertDialogDescription className="text-xs md:text-sm">This action cannot be undone. This removes tracking for this specific license/contract.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="mt-4">
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(amc.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            )}

                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* CREATE / EDIT MODAL */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if(!open) resetForm(); }}>
        <DialogContent className="w-[90vw] max-w-[450px] bg-white p-4 md:p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Update Record" : "Add AMC / License"}</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">Store warranty and contract details to track expiration dates.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveAmc} className="space-y-4 mt-2 md:mt-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="space-y-2"><Label>Vendor / Product Name *</Label><Input required value={vendorProduct} onChange={(e) => setVendorProduct(e.target.value)} placeholder="e.g., Dell Servers, Adobe CC" /></div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select required value={type} onValueChange={setType}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Software_License">Software License</SelectItem>
                    <SelectItem value="Hardware_Warranty">Hardware Warranty</SelectItem>
                    <SelectItem value="Service_Contract">Service Contract</SelectItem>
                    <SelectItem value="Domain_Hosting">Domain / Hosting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status *</Label>
                <Select required value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Expiring_Soon">Expiring Soon</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start Date *</Label><Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Expiry Date *</Label><Input type="date" required value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Annual Cost (₹)</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Optional" /></div>
              <div className="space-y-2">
                <Label>Property Assignment *</Label>
                <Select required value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {userRole === 'Super_Admin' && <SelectItem value="Global">Global / Corporate</SelectItem>}
                    {allowedProperties.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Internal Notes / Support Contact</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Phone numbers, portals, account IDs..." className="text-sm h-16" />
            </div>

            <Button type="submit" className="w-full bg-slate-900 text-white mt-2 md:mt-4">{editId ? "Save Changes" : "Create Record"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}