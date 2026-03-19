import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Download, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';

// History Tab component that fetches user's past generated videos
export default function HistoryTab({ user, userData }) {
    const [historyItems, setHistoryItems] = useState([]);
    const [loading, setLoading] = useState(true);

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
                    Your last 5 generated videos (auto-deleted after 24 hrs).
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
                                <span className="text-xs text-gray-500">
                                    {new Date(item.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="w-full mt-2 bg-[#F5A623]/30 text-[#F5A623] hover:bg-[#F5A623]/30"
                                onClick={() => window.open(item.url, '_blank')}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Download / View
                            </Button>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
