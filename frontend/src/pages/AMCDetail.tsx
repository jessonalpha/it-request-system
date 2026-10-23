import { useState, useRef, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { FileText, Trash2, Edit, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

export default function AMCDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [amc, setAmc] = useState<any>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [appSettings, setAppSettings] = useState({ companyName: "IT NextGen", logoUrl: "" })

  // Edit State
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editType, setEditType] = useState("")
  const [editVendor, setEditVendor] = useState("")
  const [editCost, setEditCost] = useState("")
  const [editStart, setEditStart] = useState("")
  const [editEnd, setEditEnd] = useState("")

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return 
    }
    
    const headers = { 'Authorization': `Bearer ${token}` }
    fetch('/api/settings', { headers }).then(res => res.json()).then(data => setAppSettings(data))

    const fetchAmc = async () => {
      const response = await fetch(`/api/amcs/${id}`, { headers })
      if (response.ok) setAmc(await response.json())
      else navigate('/amc')
    }
    fetchAmc()
  }, [id, navigate])

  const openEditModal = () => {
    setEditType(amc.type)
    setEditVendor(amc.vendorProduct)
    setEditCost(amc.cost.toString())
    setEditStart(new Date(amc.startDate).toISOString().split('T')[0])
    setEditEnd(new Date(amc.expiryDate).toISOString().split('T')[0])
    setIsEditOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/amcs/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          type: editType, 
          vendorProduct: editVendor, 
          cost: editCost, 
          startDate: editStart, 
          expiryDate: editEnd 
        }), 
      })
      if (response.ok) {
        setAmc(await response.json())
        setIsEditOpen(false)
      }
    } catch (error) { alert("Network Error") }
  }

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/amcs/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) navigate('/amc')
    } catch (error) { alert("Network Error while deleting") }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploading(true)
    
    const formData = new FormData()
    formData.append("document", e.target.files[0])

    try {
      const response = await fetch(`/api/amcs/${id}/attachments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      })
      if (response.ok) {
        const newDoc = await response.json()
        setAmc({ ...amc, attachments: [newDoc, ...(amc.attachments || [])] })
      }
    } catch (error) {
      alert("Failed to upload file")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDeleteAttachment = async (attachmentId: number) => {
    try {
      const response = await fetch(`/api/amcs/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) {
        setAmc({ ...amc, attachments: amc.attachments.filter((a: any) => a.id !== attachmentId) })
      }
    } catch (error) { alert("Network Error while deleting attachment") }
  }

  if (!amc) return <div className="p-12 text-center text-slate-500">Loading AMC details...</div>

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <Link to="/amc" className="text-blue-600 hover:underline inline-block font-medium">&larr; Back to AMC Ledger</Link>
        {appSettings.logoUrl && (
          <img src={`${appSettings.logoUrl}`} alt="Corporate Logo" className="h-14 w-auto object-contain rounded-md" />
        )}
      </div>
      
      {/* MAIN CONTRACT DETAILS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{amc.vendorProduct}</h1>
              <p className="text-sm text-slate-500 mt-1 uppercase tracking-wider font-semibold">{amc.type.replace('_', ' ')}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${amc.status === 'Expired' ? 'bg-red-100 text-red-700' : amc.status === 'Expiring_Soon' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {amc.status.replace('_', ' ')}
              </span>
              
              <Button variant="outline" size="sm" onClick={openEditModal} className="h-8 text-blue-600 border-slate-300 ml-2">
                <Edit className="w-4 h-4 mr-1" /> Edit
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-red-600 border-slate-300">
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-white">
                  <AlertDialogHeader><AlertDialogTitle>Delete AMC Contract?</AlertDialogTitle><AlertDialogDescription>This will permanently remove this contract and all attached files.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>Delete Contract</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-6 pt-4 border-t border-slate-200">
            <div><p className="text-xs text-slate-500 font-semibold mb-1 uppercase">Start Date</p><p className="font-medium text-slate-900">{new Date(amc.startDate).toLocaleDateString()}</p></div>
            <div><p className="text-xs text-slate-500 font-semibold mb-1 uppercase">Expiry Date</p><p className={`font-bold ${amc.status === 'Expired' ? 'text-red-600' : 'text-slate-900'}`}>{new Date(amc.expiryDate).toLocaleDateString()}</p></div>
            <div><p className="text-xs text-slate-500 font-semibold mb-1 uppercase">Annual Cost</p><p className="font-medium text-slate-900">{amc.cost.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p></div>
          </div>
        </div>
      </div>

      {/* ATTACHMENTS MANAGER */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Contract Documents & Licenses</h3>
          <div>
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="bg-slate-900 text-white">
              <Upload className="w-4 h-4 mr-2" /> {isUploading ? "Uploading..." : "Upload File"}
            </Button>
          </div>
        </div>
        
        <div className="p-2">
          {(!amc.attachments || amc.attachments.length === 0) ? (
            <div className="p-8 text-center text-slate-500 text-sm">No documents uploaded for this contract.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {amc.attachments.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                  <a href={`${doc.fileUrl}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-blue-600 hover:underline">
                    <div className="p-2 bg-blue-50 rounded"><FileText className="w-5 h-5" /></div>
                    <span className="font-medium text-sm">{doc.fileName}</span>
                  </a>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-400">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                    <button onClick={() => handleDeleteAttachment(doc.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* EDIT MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white">
          <DialogHeader><DialogTitle>Edit Contract</DialogTitle></DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-2">
            <div className="space-y-2"><Label>Contract Type</Label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="Hardware">Hardware SLA</SelectItem>
                  <SelectItem value="Software">Software License</SelectItem>
                  <SelectItem value="Network">Network ISP</SelectItem>
                  <SelectItem value="Domain_Hosting">Domain & Hosting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Vendor / Product Name</Label><Input required value={editVendor} onChange={(e) => setEditVendor(e.target.value)} /></div>
            <div className="space-y-2"><Label>Annual Cost (₹)</Label><Input type="number" required value={editCost} onChange={(e) => setEditCost(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start Date</Label><Input type="date" required value={editStart} onChange={(e) => setEditStart(e.target.value)} /></div>
              <div className="space-y-2"><Label>Expiry Date</Label><Input type="date" required value={editEnd} onChange={(e) => setEditEnd(e.target.value)} /></div>
            </div>
            <Button type="submit" className="w-full bg-blue-600 text-white mt-2 hover:bg-blue-700">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}