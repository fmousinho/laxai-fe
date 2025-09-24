import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface AccountLinkedModalProps {
  open: boolean;
  onClose: () => void;
}

export function AccountLinkedModal({ open, onClose }: AccountLinkedModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accounts Linked</DialogTitle>
        </DialogHeader>
        <div className="py-4 text-center text-base">
          Your Google and email accounts have been linked. You can now log in with either method.
        </div>
        <DialogFooter>
          <Button onClick={onClose} className="w-full">OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
