import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  User,
  Store,
  RefreshCw,
  Send,
} from 'lucide-react';
import api from '../../api/axios';
import {
  useToast,
  Card,
  Button,
  Badge,
  Skeleton,
  EmptyState,
  BottomSheet,
} from '../../components/ui';
import { formatPaise } from '../../utils/format';

export const AdminComplaints = () => {
  const { i18n } = useTranslation();
  const { showToast } = useToast();
  const isTe = i18n.language === 'te';

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reply modal state
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [targetStatus, setTargetStatus] = useState('resolved');
  const [submitting, setSubmitting] = useState(false);

  const fetchComplaints = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/admin/complaints');
      setComplaints(res.data.complaints || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch customer complaints');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleOpenReply = (c) => {
    setSelectedComplaint(c);
    setAdminReplyText(c.adminReply || '');
    setTargetStatus(c.status || 'resolved');
    setReplyModalOpen(true);
  };

  const handleSaveReply = async () => {
    if (!selectedComplaint || submitting) return;

    try {
      setSubmitting(true);
      await api.patch(`/admin/complaints/${selectedComplaint._id}`, {
        adminReply: adminReplyText.trim(),
        status: targetStatus,
      });

      showToast({
        type: 'success',
        message: isTe
          ? 'ఫిర్యాదు ప్రత్యుత్తరం నవీకరించబడింది'
          : 'Complaint reply updated successfully',
      });

      setReplyModalOpen(false);
      setSelectedComplaint(null);
      fetchComplaints();
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update complaint',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 antialiased">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-900 tracking-tight">
            {isTe ? 'కస్టమర్ సమస్యలు & ఫిర్యాదులు' : 'Complaints Resolution'}
          </h1>
          <p className="text-xs text-ink-500 mt-0.5">
            {isTe
              ? 'డెలివరీ ఆర్డర్లపై వచ్చిన ఫిర్యాదులను సమీక్షించండి మరియు పరిష్కరించండి'
              : 'Review feedback, investigate order discrepancies, and respond to customers'}
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={fetchComplaints}
          className="text-xs font-bold self-start sm:self-auto flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isTe ? 'రిఫ్రెష్' : 'Refresh'}</span>
        </Button>
      </div>

      {/* Complaints List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="pt-8 max-w-md mx-auto">
          <EmptyState
            icon={AlertTriangle}
            title={isTe ? 'లోడ్ చేయడం విఫలమైంది' : 'Error Loading Complaints'}
            description={error}
            actionLabel={isTe ? 'మళ్ళీ ప్రయత్నించండి' : 'Retry'}
            onAction={fetchComplaints}
          />
        </div>
      ) : complaints.length === 0 ? (
        <div className="pt-8">
          <EmptyState
            icon={CheckCircle2}
            title={isTe ? 'ఫిర్యాదులు ఏవీ లేవు' : 'No Open Complaints'}
            description={
              isTe
                ? 'ప్రస్తుతం వినియోగదారుల నుండి ఎటువంటి పెండింగ్ ఫిర్యాదులు లేవు.'
                : 'All customer queries and order complaints have been resolved.'
            }
          />
        </div>
      ) : (
        <div className="space-y-3.5">
          {complaints.map((c) => {
            const isOpen = c.status === 'open';
            return (
              <Card
                key={c._id}
                className="p-4 sm:p-5 border border-ink-200 rounded-2xl bg-white shadow-xs space-y-3 hover:border-ink-300 transition-all"
              >
                {/* Top Status & Meta */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ink-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={isOpen ? 'warning' : 'success'}>
                      {isOpen ? (
                        <>
                          <Clock className="w-3 h-3 mr-1 inline" /> Open
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1 inline" /> Resolved
                        </>
                      )}
                    </Badge>
                    <span className="text-[11px] font-bold text-ink-400 font-mono">
                      #{c.order?.orderNo || 'N/A'}
                    </span>
                    {c.order?.total && (
                      <span className="text-[11px] font-extrabold text-ink-700">
                        ({formatPaise(c.order.total)})
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-ink-400">
                    {new Date(c.createdAt).toLocaleDateString()} at{' '}
                    {new Date(c.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-ink-700">
                    <User className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                    <span className="font-bold text-ink-900">{c.user?.name}</span>
                    <span className="text-ink-400 text-[11px]">
                      ({c.user?.phone || c.user?.email})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-ink-700">
                    <Store className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="text-ink-500">Store:</span>
                    <span className="font-bold text-ink-900">
                      {c.order?.store?.name || 'Store'}
                    </span>
                  </div>
                </div>

                {/* Complaint Message */}
                <div className="p-3 rounded-xl bg-ink-50/80 border border-ink-200 text-xs">
                  <span className="text-[10px] font-extrabold uppercase text-ink-400 block mb-0.5">
                    Customer Problem Description:
                  </span>
                  <p className="text-ink-900 leading-relaxed font-medium">{c.message}</p>
                </div>

                {/* Admin Reply (if exists) */}
                {c.adminReply && (
                  <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-700 block mb-0.5">
                      Admin Response:
                    </span>
                    <p className="text-emerald-950 leading-relaxed">{c.adminReply}</p>
                  </div>
                )}

                {/* Action CTA */}
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant={isOpen ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => handleOpenReply(c)}
                    className="text-xs font-bold flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>
                      {c.adminReply
                        ? isTe
                          ? 'ప్రత్యుత్తరం మార్చండి'
                          : 'Edit Reply'
                        : isTe
                          ? 'ప్రత్యుత్తరం ఇచ్చి పరిష్కరించండి'
                          : 'Reply & Resolve'}
                    </span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reply Modal */}
      <BottomSheet
        isOpen={replyModalOpen}
        onClose={() => {
          if (!submitting) setReplyModalOpen(false);
        }}
        title={isTe ? 'ఫిర్యాదుకు స్పందించండి' : 'Respond to Complaint'}
      >
        <div className="space-y-4 pb-4">
          <div className="p-3 bg-ink-50 border border-ink-200 rounded-2xl text-xs space-y-1">
            <div className="flex justify-between font-bold text-ink-900">
              <span>{selectedComplaint?.user?.name}</span>
              <span className="font-mono text-ink-500">#{selectedComplaint?.order?.orderNo}</span>
            </div>
            <p className="text-ink-700 italic">&ldquo;{selectedComplaint?.message}&rdquo;</p>
          </div>

          {/* Admin Reply Textarea */}
          <div>
            <label
              htmlFor="admin-reply-textarea"
              className="text-xs font-bold text-ink-800 block mb-1"
            >
              {isTe ? 'అడ్మిన్ ప్రత్యుత్తర సందేశం' : 'Admin Response Message'}
            </label>
            <textarea
              id="admin-reply-textarea"
              rows={4}
              placeholder={
                isTe
                  ? 'కస్టమర్‌కు సమాధానం రాయండి...'
                  : 'Write resolution notes or instructions for the customer...'
              }
              value={adminReplyText}
              onChange={(e) => setAdminReplyText(e.target.value)}
              className="w-full bg-ink-50 border border-ink-200 focus:border-primary-500 focus:bg-white rounded-xl p-3 text-xs outline-none transition-all placeholder:text-ink-400"
            />
          </div>

          {/* Status Radio */}
          <div>
            <span className="text-xs font-bold text-ink-800 block mb-1.5">
              {isTe ? 'సమస్య స్థితి' : 'Resolution Status'}
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTargetStatus('resolved')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  targetStatus === 'resolved'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                    : 'border-ink-200 bg-white text-ink-600'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{isTe ? 'పరిష్కరించబడింది' : 'Mark Resolved'}</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetStatus('open')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  targetStatus === 'open'
                    ? 'border-amber-600 bg-amber-50 text-amber-800'
                    : 'border-ink-200 bg-white text-ink-600'
                }`}
              >
                <Clock className="w-4 h-4 text-amber-600" />
                <span>{isTe ? 'ఓపెన్‌లో ఉంచండి' : 'Keep Open'}</span>
              </button>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              disabled={submitting}
              onClick={() => setReplyModalOpen(false)}
              className="flex-1 font-bold text-xs"
            >
              {isTe ? 'రద్దు' : 'Cancel'}
            </Button>

            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={submitting}
              onClick={handleSaveReply}
              className="flex-1 font-extrabold text-xs flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {submitting
                  ? isTe
                    ? 'సేవ్ చేస్తోంది...'
                    : 'Saving...'
                  : isTe
                    ? 'సేవ్ చేయి'
                    : 'Save & Update'}
              </span>
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
