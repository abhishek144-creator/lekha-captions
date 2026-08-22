import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Download, Video, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveApiResourceUrl } from './exportPipelineUtils';
import { toDateSafe } from '@/lib/subscription';
import { apiRequest, getApiErrorMessage } from '@/lib/apiClient';
import { getEffectiveAuthToken } from '@/lib/devAuth';
import { toast } from '@/components/ui/use-toast';

// History Tab component that fetches user's past generated videos
export default function HistoryTab({ user, userData }) {
    const [historyItems, setHistoryItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleteConfirmId, setDeleteConfirmId] = useState('');
    const [deletingId, setDeletingId] = useState('');

    useEffect(() => {
        // In the future, this will fetch specifically from a Firebase subcollection 
        // e.g. db.collection('users').doc(user.uid).collection('history')
        // For now, if there is no backend populated History array, we show empty state.

        if (user && userData) {
            // Simulate fetching
            setTimeout(() => {
                setHistoryItems(userData.history || []);
                setLoading(false);
            }, 800);
        } else {
            setLoading(false);
        }
    }, [user, userData]);

    const deleteHistoryItem = async (item) => {
        const fileId = String(item?.id || '').trim();
        if (!fileId || deletingId) return;

        setDeletingId(fileId);
        try {
            const idToken = await getEffectiveAuthToken(user);
            if (!idToken) throw new Error('Your session has expired. Please sign in again.');

            await apiRequest('/api/delete-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_id: fileId, id_token: idToken }),
                dedupeKey: `delete-file:${fileId}`,
            });

            setHistoryItems((items) => items.filter((historyItem) => String(historyItem?.id || '') !== fileId));
            setDeleteConfirmId('');
            toast({
                title: 'Video deleted',
                description: 'The source media, exports, and history entry were removed.',
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not delete video',
                description: getApiErrorMessage(error, 'Please try again or contact support.'),
            });
        } finally {
            setDeletingId('');
        }
    };

    if (!user) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <Video className="w-12 h-12 text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Login Required</h3>
                <p className="text-sm text-gray-400">
                    Sign in to view your past video generations.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-[#F5A623] animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-white mb-2">Your History</h2>
                <p className="text-sm text-gray-500">
                    Your last 5 generated videos. Availability follows your plan's export-retention window.
                </p>
            </div>

            {historyItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-white/10 rounded-xl">
                    <Video className="w-10 h-10 text-gray-600 mb-3" />
                    <h3 className="text-sm font-medium text-gray-300">No History Yet</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                        Videos you export will appear here.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {historyItems.map((item, idx) => (
                        <motion.div
                            key={item.id || idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-medium text-white truncate max-w-[150px]">
                                    {item.filename || 'Exported Video'}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">
                                        {toDateSafe(item.createdAt)?.toLocaleDateString() || 'Recently'}
                                    </span>
                                    {deleteConfirmId !== String(item.id || '') && (
                                        <button
                                            type="button"
                                            title="Delete video"
                                            aria-label={`Delete ${item.filename || 'video'}`}
                                            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                                            disabled={Boolean(deletingId)}
                                            onClick={() => setDeleteConfirmId(String(item.id || ''))}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="w-full mt-2 bg-[#F5A623]/30 text-[#F5A623] hover:bg-[#F5A623]/30"
                                onClick={() => {
                                    const mediaUrl = resolveApiResourceUrl(
                                        item.url,
                                        import.meta.env.VITE_API_BASE_URL,
                                    )
                                    if (!mediaUrl) return
                                    const opened = window.open(mediaUrl, '_blank', 'noopener,noreferrer')
                                    if (opened) opened.opener = null
                                }}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Download / View
                            </Button>
                            {deleteConfirmId === String(item.id || '') && (
                                <div className="mt-3 rounded-lg border border-red-400/20 bg-red-500/5 p-3">
                                    <p className="text-xs text-red-200">Delete this video and its exports?</p>
                                    <div className="mt-2 flex gap-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="flex-1 text-gray-300 hover:bg-white/10"
                                            disabled={deletingId === String(item.id || '')}
                                            onClick={() => setDeleteConfirmId('')}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            className="flex-1"
                                            disabled={deletingId === String(item.id || '')}
                                            onClick={() => deleteHistoryItem(item)}
                                        >
                                            {deletingId === String(item.id || '') ? 'Deleting…' : 'Delete'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
