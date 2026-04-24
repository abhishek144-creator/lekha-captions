import React, { useState } from "react"
import { useAuth } from "@/lib/AuthContext"
import { apiRequest } from "@/lib/apiClient"
import { notifyApiError } from "@/lib/notifyApiError"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminOps() {
  const { currentUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState(null)

  const run = async (path, body = {}) => {
    setLoading(true)
    try {
      const idToken = (await currentUser?.getIdToken?.()) || currentUser?.accessToken || ""
      const data = await apiRequest(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
