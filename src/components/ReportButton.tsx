import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { notifyAdmins } from "@/lib/notifications";

interface ReportButtonProps {
  targetType: "catch" | "comment" | "profile";
  targetId: string;
  label?: string;
  className?: string;
}

export const ReportButton = ({ targetType, targetId, label = "Report", className }: ReportButtonProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please sign in to report");
      navigate("/auth");
      return;
    }

    if (!reason.trim()) {
      toast.error("Please describe the issue");
      return;
    }

    setSubmitting(true);
    const payload = {
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason: reason.trim(),
    };

    const { data: reportRecord, error } = await supabase
      .from("reports")
      .insert(payload)
      .select("id, target_type, target_id")
      .single();

    if (error) {
      console.error("Failed to submit report", error);
      toast.error("Unable to submit report. Please try again.");
    } else {
      toast.success("Report submitted");
      setOpen(false);
      setReason("");
      void notifyAdmins({
        reporter_id: user.id,
        target_type: targetType,
        target_id: targetId,
        report_id: reportRecord?.id,
        reason: reason.trim(),
        message: `${user.user_metadata?.username ?? user.email ?? "Someone"} reported a ${targetType}.`,
      });
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !submitting && setOpen(value)}>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" className={className}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this {targetType}</DialogTitle>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Let us know what doesn't look right."
          rows={4}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Sending…" : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportButton;
