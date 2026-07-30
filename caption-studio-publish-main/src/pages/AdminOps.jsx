import { useCallback, useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "@/lib/AuthContext"
import { apiRequest } from "@/lib/apiClient"
import { notifyApiError } from "@/lib/notifyApiError"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const SERVICE_CONTROLS = [
  { key: "maintenance_mode", label: "Maintenance mode", hint: "Blocks payments, uploads, transcription, exports, and new sign-ups" },
  { key: "pause_signups", label: "Pause new sign-ups", hint: "Existing accounts keep working" },
  { key: "pause_payments", label: "Pause payments", hint: "Stops new Razorpay orders before any charge can begin" },
  { key: "pause_uploads", label: "Pause uploads", hint: "Stops new files entering the pipeline" },
  { key: "pause_transcription", label: "Pause transcription", hint: "Stops paid AI provider spend" },
  { key: "pause_exports", label: "Pause exports", hint: "Stops render/CPU spend; captions stay saved" },
]

export default function AdminOps() {
  const { currentUser, userData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState(null)
  const [controls, setControls] = useState(null)
  const [notice, setNotice] = useState("")

  const isAdmin = userData?.role === "admin" || userData?.roles?.includes("admin")

  // Declared before the access guard so hook order stays stable across renders.
  const refreshControls = useCallback(async () => {
    try {
      const data = await apiRequest("/api/service-status", { method: "GET" })
      setControls(data?.controls || null)
      setNotice(data?.notice || "")
    } catch (e) {
      notifyApiError(e, "Could not read service controls")
    }
  }, [])

  useEffect(() => {
    if (currentUser && isAdmin) refreshControls()
  }, [currentUser, isAdmin, refreshControls])

  if (!currentUser || !isAdmin) {
    return <Navigate to="/Dashboard" replace />
  }

  const setControl = async (key, value) => {
    setLoading(true)
    try {
      const idToken = (await currentUser?.getIdToken?.()) || ""
      const data = await apiRequest("/api/admin/service-controls", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ id_token: idToken, [key]: value, notice }),
      })
      setControls(data?.controls || null)
      setOutput(data)
    } catch (e) {
      notifyApiError(e, "Could not update service controls")
    } finally {
      setLoading(false)
    }
  }

  const run = async (path, body = {}) => {
    setLoading(true)
    try {
      const idToken = (await currentUser?.getIdToken?.()) || ""
      const data = await apiRequest(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ ...body, id_token: idToken }),
      })
      setOutput(data)
    } catch (e) {
      notifyApiError(e, "Admin action failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Admin Ops</h1>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Service Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-zinc-400">
              Emergency switches. They take effect within about 10 seconds and survive a restart. Users see a 503 with
              the notice below instead of a broken screen.
            </p>
            <div className="space-y-2">
              {SERVICE_CONTROLS.map((control) => {
                const active = Boolean(controls?.[control.key])
                return (
                  <div
                    key={control.key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded border border-zinc-800 bg-zinc-950 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {control.label}
                        <span className={`ml-3 text-xs ${active ? "text-red-400" : "text-emerald-400"}`}>
                          {active ? "PAUSED" : "live"}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-500">{control.hint}</p>
                    </div>
                    <Button
                      disabled={loading || !controls}
                      variant={active ? "secondary" : "destructive"}
                      onClick={() => setControl(control.key, !active)}
                    >
                      {active ? "Resume" : "Pause"}
                    </Button>
                  </div>
                )
              })}
            </div>
            <div className="space-y-2">
              <label htmlFor="service-notice" className="block text-xs text-zinc-400">
                Message shown to users while paused (optional, saved with the next toggle)
              </label>
              <input
                id="service-notice"
                value={notice}
                onChange={(e) => setNotice(e.target.value)}
                maxLength={280}
                placeholder="Back in about 30 minutes — your work is saved."
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
            </div>
            <Button disabled={loading} variant="secondary" onClick={refreshControls}>
              Refresh status
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Recovery Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button disabled={loading} onClick={() => run("/api/admin/recovery-summary", { limit: 50 })}>
              Load Recovery Summary
            </Button>
            <Button disabled={loading} variant="secondary" onClick={() => run("/api/reconcile-payments", { lookback_hours: 48, limit: 200 })}>
              Run Payment Reconcile
            </Button>
            <Button disabled={loading} variant="secondary" onClick={() => run("/api/admin/tenant-backfill", { limit: 500 })}>
              Run Tenant Backfill
            </Button>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Output</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto whitespace-pre-wrap">
              {output ? JSON.stringify(output, null, 2) : "No output yet"}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
