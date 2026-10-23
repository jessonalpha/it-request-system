import { useState, useEffect, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Bell, LogOut, CheckCircle2, X, Search, Download, Trash2, FileText, Image as ImageIcon, Box, FileArchive, UploadCloud, Menu, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

export default function ResourceHub() {
  const navigate = useNavigate()
  
  const [resources, setResources] = useState<any[]>([]) 
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  
  const userRole = localStorage.getItem('role') || 'User'
  const isAdmin = userRole === 'Admin' || userRole === 'Super_Admin'

  const [appSettings, setAppSettings] = useState({ companyName: "IT NextGen", logoUrl: "" })
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Upload State
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("SOPs")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
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

    fetch('/api/settings', { headers }).then(res => res.json()).then(data => setAppSettings(data))

    const fetchResources = async () => {
      try {
        const response = await fetch('/api/resources', { headers })
        if (response.status === 401 || response.status === 403) return handleLogout()
        if (response.ok) setResources(await response.json())
      } catch (error) {
        console.error("Failed to fetch resources")
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
      } catch (error) { 
        console.error("Failed to fetch notifications") 
      }
    }

    fetchResources()
    fetchNotifications()
    
    const intervalId = setInterval(fetchNotifications, 15000)
    return () => clearInterval(intervalId)
  }, [navigate])

  // --- IMMEDIATE FORCE DOWNLOAD HELPER ---
  const handleForceDownload = async (fileUrl: string, resourceId: number) => {
    setDownloadingId(resourceId);
    const fullUrl = `${fileUrl}`;
    const filename = fileUrl.split('/').pop() || 'download';

    try {
      // Fetch the file as a Blob to prevent the browser from opening it in a new tab
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error("Network response was not ok");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed, falling back to new tab", error);
      // Fallback: If CORS or fetch fails, just open it in a new tab normally
      window.open(fullUrl, '_blank');
    } finally {
      setDownloadingId(null);
    }
  }

  // --- IMAGE PREVIEW CHECKER ---
  const isImageFile = (url: string) => {
    if (!url) return false;
    const ext = url.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !selectedFile) return alert("Title and file are required.")

    const formData = new FormData()
    formData.append("title", title)
    formData.append("description", description)
    formData.append("category", category)
    formData.append("file", selectedFile)

    try {
      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      })
      
      if (response.ok) {
        const newResource = await response.json()
        setResources([newResource, ...resources])
        setIsUploadOpen(false)
        setTitle(""); setDescription(""); setCategory("SOPs"); setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        alert("Failed to upload resource.")
      }
    } catch (error) { alert("Network Error") }
  }

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/resources/${id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) setResources(resources.filter(r => r.id !== id))
    } catch (error) { alert("Error deleting resource") }
  }

  // --- BIGGER CATEGORY ICONS FOR FALLBACK ---
  const getCategoryIcon = (cat: string) => {
    switch(cat) {
      case 'Brand_Assets': return <ImageIcon className="w-10 h-10 md:w-12 md:h-12 text-pink-500/50" />
      case 'Software': return <Box className="w-10 h-10 md:w-12 md:h-12 text-blue-500/50" />
      case 'Forms': return <FileArchive className="w-10 h-10 md:w-12 md:h-12 text-amber-500/50" />
      default: return <FileText className="w-10 h-10 md:w-12 md:h-12 text-emerald-500/50" />
    }
  }

  const displayedResources = resources.filter(r => {
    const matchesCategory = activeCategory === "All" || r.category === activeCategory;
    const matchesSearch = (r.title && r.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
                          (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length
  const categories = ["All", "SOPs", "Brand_Assets", "Software", "Forms"]

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
              <Button variant="secondary" className="w-full text-slate-900 font-semibold bg-slate-100 hover:bg-white" onClick={() => { setIsMobileMenuOpen(false); setIsUploadOpen(true); }}>
                Upload Resource
              </Button>
            )}
          </div>
        </aside>

        {/* MOBILE-OPTIMIZED MAIN CONTENT */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden w-full">
          <header className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">Resource Hub</h1>
              <p className="text-xs md:text-sm text-slate-500">Download company SOPs, logos, policies, and software assets.</p>
            </div>
            <div className="relative w-full md:w-72 shrink-0">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search resources..." 
                className="pl-10 bg-white text-sm md:text-base h-10 md:h-12"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </header>

          <div className="flex gap-2 mb-6 md:mb-8 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-indigo-900 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              >
                {cat.replace('_', ' ')}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="p-8 md:p-12 text-center text-sm md:text-base text-slate-500">Loading resources...</div>
          ) : displayedResources.length === 0 ? (
            <div className="p-8 md:p-12 text-center text-sm md:text-base text-slate-500 bg-white rounded-xl border border-slate-200">No resources found matching your search or category.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {displayedResources.map((res) => (
                <Card key={res.id} className="bg-white border-slate-200 hover:shadow-lg transition-all flex flex-col group overflow-hidden">
                  
                  {/* --- BIG THUMBNAIL PREVIEW --- */}
                  <div className={`relative w-full h-32 md:h-40 flex items-center justify-center shrink-0 border-b border-slate-100 ${res.category === 'Brand_Assets' ? 'bg-pink-100' : res.category === 'Software' ? 'bg-blue-100' : res.category === 'Forms' ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                    {isImageFile(res.fileUrl) ? (
                      <img src={`${res.fileUrl}`} alt={res.title} className="w-full h-full object-cover" />
                    ) : (
                      getCategoryIcon(res.category)
                    )}

                    {/* Admin Delete Action Floating Over Image */}
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-md backdrop-blur-sm md:opacity-0 md:group-hover:opacity-100 transition-all shadow-sm">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[90vw] max-w-[400px] bg-white rounded-xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Resource?</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs md:text-sm">This will permanently delete the file "{res.title}" from the server.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="mt-4">
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(res.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>

                  <CardContent className="p-3 md:p-4 flex flex-col flex-1">
                    
                    <p className="text-[9px] md:text-[10px] font-bold text-indigo-600 mb-1 uppercase tracking-wider">{res.category.replace('_', ' ')}</p>
                    <h3 className="font-bold text-slate-900 text-sm md:text-base line-clamp-1 mb-1.5" title={res.title}>{res.title}</h3>
                    
                    <p className="text-[10px] md:text-xs text-slate-500 line-clamp-2 mb-4 flex-1 leading-relaxed">{res.description || "No description provided."}</p>
                    
                    <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[9px] text-slate-400 font-medium">Added {new Date(res.createdAt).toLocaleDateString()}</span>
                      
                      {/* --- IMMEDIATE DOWNLOAD BUTTON --- */}
                      <button 
                        onClick={() => handleForceDownload(res.fileUrl, res.id)} 
                        disabled={downloadingId === res.id}
                        className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-slate-700 hover:text-indigo-600 transition-colors bg-slate-100 hover:bg-indigo-50 px-2 py-1.5 md:px-2.5 md:py-1.5 rounded-md disabled:opacity-50"
                      >
                        {downloadingId === res.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        {downloadingId === res.id ? "Saving..." : "Get File"}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* UPLOAD MODAL (ADMIN ONLY) */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="w-[90vw] max-w-[425px] bg-white p-4 md:p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle>Upload Resource</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">Add a new document or asset to the global Knowledge Base.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 mt-2 md:mt-4">
            <div className="space-y-2"><Label>Title *</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Q3 Marketing Logos" className="text-sm" /></div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Briefly describe what this file is for..." className="text-sm h-20" />
            </div>

            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="SOPs">SOPs & Guides</SelectItem>
                  <SelectItem value="Brand_Assets">Brand Assets (Logos, Fonts)</SelectItem>
                  <SelectItem value="Software">Software & Tools</SelectItem>
                  <SelectItem value="Forms">Forms & Templates</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 pt-2">
              <Label>File Upload *</Label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 md:p-6 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud className="w-6 h-6 md:w-8 md:h-8 text-indigo-400 mb-2" />
                <span className="text-xs md:text-sm font-semibold text-slate-700 truncate max-w-[200px] md:max-w-[250px]">{selectedFile ? selectedFile.name : "Click to browse files"}</span>
                <span className="text-[10px] md:text-xs text-slate-400 mt-1">PDF, DOCX, ZIP, PNG, JPG (Max 50MB)</span>
                <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)} />
              </div>
            </div>

            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-2 md:mt-4">Upload Asset</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}