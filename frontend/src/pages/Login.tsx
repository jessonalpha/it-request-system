import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function Login() {
  const [email, setEmail] = useState("admin@corporate.com")
  const [password, setPassword] = useState("password123")
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()
      console.log("FULL LOGIN RESPONSE FROM SERVER:", data) // <-- Check this in F12 console

    if (response.ok && data.token) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('role', data.role || 'User');
        window.location.href = '/dashboard'; // Forces a hard reload with the token ready
      } else {
        setError(data.error || "Login failed - no token received")
      }
    } catch (err: any) {
      setError("Failed to connect to backend")
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-100">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">IT Helpdesk</h1>
        <p className="text-sm text-slate-500 mb-6">Sign in to your corporate account to manage requests.</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>
          <Button type="submit" className="w-full bg-slate-900 text-white mt-2">
            Login
          </Button>
        </form>
      </div>
    </div>
  )
}