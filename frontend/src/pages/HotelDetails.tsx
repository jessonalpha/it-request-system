import { useState, useEffect, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Building2, MapPin, Phone, Globe, MessageCircle, Camera, Video, Briefcase, AtSign, Users as UsersIcon, Bell, LogOut, CheckCircle2, X, Menu, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardTitle, CardDescription, } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

export default function HotelDetails() {
  const navigate = useNavigate()
  const [properties, setProperties] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  
  const userRole = localStorage.getItem('role') || 'User'
  const isAdmin = userRole === 'Admin' || userRole === 'Super_Admin'
  
  const [appSettings, setAppSettings] = useState({ companyName: "IT NextGen", logoUrl: "" })
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // --- Property Filter State ---
  const [allowedProperties, setAllowedProperties] = useState<any[]>([])
  const [activeProperty, setActiveProperty] = useState(localStorage.getItem('activeProperty') || 'All')

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('activeProperty')
    window.location.href = '/login'
  }

  // Track previous unread count to trigger the audio playback
  const prevUnreadCount = useRef<number | null>(null)

  useEffect(() => {
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
        // Force non-Super Admins out of 'All' view if they happen to have it stored
        if (data.role !== 'Super_Admin' && activeProperty === 'All') {
          const defaultProp = data.properties && data.properties.length > 0 ? data.properties[0].id.toString() : ""
          setActiveProperty(defaultProp)
          localStorage.setItem('activeProperty', defaultProp)
        }
      })

    const fetchData = async () => {
      try {
        const setRes = await fetch('/api/settings', { headers })
        if (setRes.ok) setAppSettings(await setRes.json())

        const propRes = await fetch('/api/properties', { headers })
        if (propRes.ok) setProperties(await propRes.json())

        const userRes = await fetch(`/api/users?propertyFilter=${activeProperty}`, { headers })
        if (userRes.ok) setUsers(await userRes.json())
        
      } catch (error) { 
        console.error("Failed to fetch data:", error) 
      } finally { 
        setLoading(false) 
      }
    }

    // Live Notification Fetcher
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
      } catch (error) { 
        console.error("Failed to fetch notifications") 
      }
    }

    fetchData()
    fetchNotifications() // Initial load
    
    // Poll the server every 15 seconds for new notifications
    const intervalId = setInterval(fetchNotifications, 15000)
    
    // Cleanup interval when leaving the page
    return () => clearInterval(intervalId)
  }, [navigate, activeProperty]) // Re-run when context switches

  const handleContextSwitch = (val: string) => {
    setActiveProperty(val)
    localStorage.setItem('activeProperty', val)
    window.location.reload()
  }

  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n))
    } catch (error) { console.error("Failed to mark read") }
  }

  const clearNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation() 
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications(notifications.filter((n: any) => n.id !== id))
    } catch (error) { console.error("Failed to clear notification") }
  }

  const clearAllNotifications = async () => {
    try {
      await fetch(`/api/notifications`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications([])
    } catch (error) { console.error("Failed to clear notifications") }
  }

  // Filter properties based on both Search Query AND Active Context Selection
  const filteredProperties = properties.filter(h => {
    const searchString = `${h.name || ''} ${h.code || ''} ${h.location || ''}`.toLowerCase();
    const matchesSearch = searchString.includes(searchQuery.toLowerCase());
    const matchesContext = activeProperty === 'All' || h.id.toString() === activeProperty;
    
    return matchesSearch && matchesContext;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      
      {/* MOBILE-OPTIMIZED TOP RIBBON */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 md:px-6 shrink-0 shadow-md relative z-30">
        <div className="flex items-center gap-3">
          {/* Hamburger Menu (Mobile Only) */}
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
          
          <div className="mt-auto space-y-4 w-full shrink-0">
            <div className="text-sm text-slate-400 text-center pb-3 border-b border-slate-700 hidden md:block">
              Logged in as: <br/>
              <span className="text-white font-bold tracking-wide">{userRole}</span>
            </div>
            {isAdmin && (
              <Button variant="secondary" onClick={() => { setIsMobileMenuOpen(false); navigate('/settings'); }} className="w-full text-slate-900 font-semibold bg-slate-100 hover:bg-white">
                Manage Hotels
              </Button>
            )}
          </div>
        </aside>

        {/* MOBILE-OPTIMIZED MAIN CONTENT */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden w-full">
          <header className="mb-6 md:mb-8 bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-slate-900">Hotel Details & Staffing</h1>
              <p className="text-xs md:text-sm text-slate-500 mt-1">Comprehensive overview of active properties and their assigned personnel.</p>
            </div>
            
            {/* SEARCH BAR */}
            <div className="relative w-full md:w-72 shrink-0">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search by name, code, or city..." 
                className="pl-10 bg-slate-50 text-sm md:text-base h-10 border-slate-200 focus-visible:ring-indigo-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </header>

          {loading ? (
            <div className="text-center text-sm md:text-base text-slate-500 p-8 md:p-12">Loading hotel details...</div>
          ) : filteredProperties.length === 0 ? (
            <div className="p-8 md:p-12 text-center text-sm md:text-base text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
              No properties found matching "{searchQuery}" in this context.
            </div>
          ) : (
            <div className="space-y-6 md:space-y-8">
              {filteredProperties.map((hotel) => {
                const hotelStaff = users.filter(u => u.propertyId === hotel.id)

                return (
                  <Card key={hotel.id} className="border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
                    <div className="bg-slate-50 p-4 md:p-6 md:w-1/3 border-b md:border-b-0 md:border-r border-slate-200">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 md:p-3 bg-blue-600 text-white rounded-xl shadow-sm shrink-0"><Building2 className="w-5 h-5 md:w-6 md:h-6" /></div>
                        <div>
                          <CardTitle className="text-lg md:text-xl text-slate-900 line-clamp-1">{hotel.name}</CardTitle>
                          <CardDescription className="font-mono text-[10px] md:text-xs uppercase mt-0.5 text-slate-500 tracking-wider">Property Code: {hotel.code}</CardDescription>
                        </div>
                      </div>

                      <div className="space-y-3 mt-4 md:mt-6">
                        {hotel.address && (
                          <div className="flex items-start gap-3 text-xs md:text-sm text-slate-700">
                            <MapPin className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                            <span className="leading-snug">{hotel.address}<br/>{hotel.location}</span>
                          </div>
                        )}
                        {hotel.landphone && (
                          <div className="flex items-center gap-3 text-xs md:text-sm text-slate-700">
                            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>{hotel.landphone}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-4 md:pt-6 mt-4 md:mt-6 border-t border-slate-200">
                        {hotel.website && <a href={hotel.website} target="_blank" rel="noopener noreferrer" className="p-1.5 md:p-2 bg-white border border-slate-200 text-slate-600 rounded-full hover:bg-slate-100 transition-colors" title="Website"><Globe className="w-3 h-3 md:w-4 md:h-4" /></a>}
                        {hotel.facebook && <a href={hotel.facebook} target="_blank" rel="noopener noreferrer" className="p-1.5 md:p-2 bg-white border border-slate-200 text-blue-600 rounded-full hover:bg-blue-50 transition-colors" title="Facebook"><MessageCircle className="w-3 h-3 md:w-4 md:h-4" /></a>}
                        {hotel.instagram && <a href={hotel.instagram} target="_blank" rel="noopener noreferrer" className="p-1.5 md:p-2 bg-white border border-slate-200 text-pink-600 rounded-full hover:bg-pink-50 transition-colors" title="Instagram"><Camera className="w-3 h-3 md:w-4 md:h-4" /></a>}
                        {hotel.linkedin && <a href={hotel.linkedin} target="_blank" rel="noopener noreferrer" className="p-1.5 md:p-2 bg-white border border-slate-200 text-sky-600 rounded-full hover:bg-sky-50 transition-colors" title="LinkedIn"><Briefcase className="w-3 h-3 md:w-4 md:h-4" /></a>}
                        {hotel.youtube && <a href={hotel.youtube} target="_blank" rel="noopener noreferrer" className="p-1.5 md:p-2 bg-white border border-slate-200 text-red-600 rounded-full hover:bg-red-50 transition-colors" title="YouTube"><Video className="w-3 h-3 md:w-4 md:h-4" /></a>}
                        {hotel.threads && <a href={hotel.threads} target="_blank" rel="noopener noreferrer" className="p-1.5 md:p-2 bg-white border border-slate-200 text-slate-800 rounded-full hover:bg-slate-100 transition-colors" title="Threads"><AtSign className="w-3 h-3 md:w-4 md:h-4" /></a>}
                      </div>
                    </div>

                    <div className="p-4 md:p-6 md:w-2/3 bg-white w-full overflow-hidden">
                      <h3 className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <UsersIcon className="w-4 h-4 text-slate-400" /> Assigned Personnel
                      </h3>
                      
                      {hotelStaff.length === 0 ? (
                        <div className="p-6 md:p-8 text-center text-xs md:text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
                          No staff currently assigned to this property.
                        </div>
                      ) : (
                        // MOBILE TABLE WRAPPER
                        <div className="border border-slate-100 rounded-lg overflow-x-auto w-full">
                          <Table className="min-w-[400px] w-full">
                            <TableHeader className="bg-slate-50">
                              <TableRow>
                                <TableHead className="text-xs">Staff Name</TableHead>
                                <TableHead className="text-xs">Role</TableHead>
                                <TableHead className="text-xs">Contact Details</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {hotelStaff.map((staff) => (
                                <TableRow key={staff.id}>
                                  <TableCell className="font-bold text-slate-800 text-xs">
                                    {staff.firstName || staff.lastName ? `${staff.firstName || ''} ${staff.lastName || ''}`.trim() : "—"}
                                  </TableCell>
                                  <TableCell>
                                    <span className="px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold bg-slate-100 text-slate-700 whitespace-nowrap">
                                      {staff.role.replace('_', ' ')}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-slate-600 text-[10px] md:text-xs space-y-0.5 md:space-y-1">
                                    <div className="truncate max-w-[150px] md:max-w-none" title={staff.email}>{staff.email}</div>
                                    {staff.phone && <div className="truncate">{staff.phone}</div>}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}