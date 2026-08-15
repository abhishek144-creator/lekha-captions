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

const METRIC_CARDS = [
  ["signups", "Sign-ups"],
  ["uploads", "Uploads"],
  ["completed_transcriptions", "Completed transcriptions"],
  ["completed_exports", "Completed exports"],
  ["failure_percentage", "Failure percentage", "%"],
  ["average_processing_time_ms", "Average processing time", "ms"],
  ["processing_p95_ms", "Processing p95", "ms"],
  ["cost_per_job_usd", "Estimated cost per job", "USD"],
  ["successful_payments", "Successful payments"],
  ["failed_payments", "Failed payments"],
  ["support_requests", "Support requests"],
]

export default function AdminOps() {
  const { currentUser, userData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState(null)
  const [controls, setControls] = useState(null)
  const [notice, setNotice] = useState("")
  const [maxDurationSeconds, setMaxDurationSeconds] = useState("180")
  const [metrics, setMetrics] = useState(null)
  const [metricsWindow, setMetricsWindow] = useState(null)

  const isAdmin = userData?.role === "admin" || userData?.roles?.includes("admin")

  // Declared before the access guard so hook order stays stable across renders.
  const refreshControls = useCallback(async () => {
    try {
      const data = await apiRequest("/api/service-status", { method: "GET" })
      setControls(data?.controls || null)
      setNotice(data?.notice || "")
      setMaxDurationSeconds(String(data?.controls?.max_upload_duration_seconds || 180))
    } catch (e) {
      notifyApiError(e, "Could not read service controls")
    }
  }, [])

  const refreshMetrics = useCallback(async () => {
    try {
      const idToken = (await currentUser?.getIdToken?.()) || ""
      const data = await apiRequest("/api/analytics/summary", {
        headers: { Authorization: `Bearer ${idToken}` },
      })
      setMetrics(data?.metrics || null)
      setMetricsWindow(data?.window || null)
    } catch (e) {
      notifyApiError(e, "Could not read production metrics")
    }
  }, [currentUser])

  useEffect(() => {
    if (currentUser && isAdmin) {
      refreshControls()
      refreshMetrics()
    }
  }, [currentUser, isAdmin, refreshControls, refreshMetrics])

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

  const saveMaxDuration = async () => {
    const value = Math.max(15, Math.min(180, Number(maxDurationSeconds) || 180))
    setMaxDurationSeconds(String(value))
    await setControl("max_upload_duration_seconds", value)
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
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Production Metrics</CardTitle>
              <p className="mt-1 text-xs text-zinc-500">
                {metricsWindow?.date ? `${metricsWindow.date} ${metricsWindow.timezone}` : "Current UTC day"}
              </p>
            </div>
            <Button disabled={loading} variant="secondary" onClick={refreshMetrics}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {METRIC_CARDS.map(([key, label, unit]) => (
                <div key={key} className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">
                  <p className="text-xs text-zinc-500">{label}</p>
                  <p className="mt-1 text-xl font-semibold">
                    {metrics ? metrics[key] ?? 0 : "—"}
                    {unit ? <span className="ml-1 text-xs font-normal text-zinc-500">{unit}</span> : null}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Cost uses configured provider and render estimates. Operational counters are server-owned.
            </p>
          </CardContent>
        </Card>

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
            <div className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <label htmlFor="max-upload-duration" className="text-sm font-medium">
                    Maximum upload duration
                  </label>
                  <p className="text-xs text-zinc-500">
                    Emergency ceiling from 15 to 180 seconds. Plan-specific limits still apply.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="max-upload-duration"
                    type="number"
                    min="15"
                    max="180"
                    step="5"
                    value={maxDurationSeconds}
                    onChange={(e) => setMaxDurationSeconds(e.target.value)}
                    className="w-24 rounded border border-zinc-700 bg-black px-3 py-2 text-sm outline-none focus:border-zinc-500"
                  />
                  <span className="text-xs text-zinc-500">seconds</span>
                  <Button disabled={loading || !controls} variant="secondary" onClick={saveMaxDuration}>
                    Save
                  </Button>
                </div>
              </div>
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
