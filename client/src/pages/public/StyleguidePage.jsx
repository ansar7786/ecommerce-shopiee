import { useState } from 'react';
import { ShoppingBag, Sparkles, Search, Mail, ArrowRight, RotateCcw } from 'lucide-react';
import {
  Button,
  Input,
  Chip,
  Badge,
  Card,
  Skeleton,
  EmptyState,
  QuantityStepper,
  BottomSheet,
  Timeline,
  useToast,
} from '../../components/ui';
import { LanguageToggle } from '../../components/LanguageToggle';

export const StyleguidePage = () => {
  const { showToast } = useToast();

  // State for interactive components
  const [btnLoading, setBtnLoading] = useState(false);
  const [selectedChip, setSelectedChip] = useState('groceries');
  const [stepperValue, setStepperValue] = useState(2);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const sampleTimelineSteps = [
    {
      id: '1',
      label: 'Order Placed',
      description: 'Customer placed order for 4 items',
      status: 'done',
      time: '10:30 AM',
    },
    {
      id: '2',
      label: 'Store Accepted & Packing',
      description: 'Store is picking and packing items',
      status: 'current',
      time: '10:32 AM',
    },
    {
      id: '3',
      label: 'Out for Delivery',
      description: 'Delivery partner on the way',
      status: 'pending',
      time: 'Pending',
    },
    {
      id: '4',
      label: 'Delivered',
      description: 'Package delivered to doorstep',
      status: 'pending',
      time: 'Pending',
    },
  ];

  const handleFireToast = () => {
    showToast({
      type: 'info',
      message: 'Items updated successfully in your cart',
      action: {
        label: 'Undo',
        onClick: () => {
          showToast({ type: 'success', message: 'Action undone!' });
        },
      },
    });
  };

  const handleFireErrorToast = () => {
    showToast({
      type: 'error',
      message: 'Failed to connect to store network',
      action: {
        label: 'Retry',
        onClick: () => {
          showToast({ type: 'success', message: 'Reconnected successfully!' });
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-page py-8 px-4 sm:px-6 antialiased">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header & Telugu Verification */}
        <header className="bg-white rounded-card p-6 border border-ink-300/60 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-600 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Step 1 Design System</span>
            </div>
            <h1 className="text-3xl font-extrabold text-ink-900 tracking-tight">
              Kirana Platform Styleguide
            </h1>
            <p className="text-sm text-ink-600 mt-1">
              Design tokens, UI primitives, and layout systems.
            </p>
          </div>
          <LanguageToggle />
        </header>

        {/* Telugu Font Verification Box */}
        <section className="bg-emerald-50/60 border border-emerald-200 rounded-card p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary-700 mb-1">
            Telugu Typography Rendering Verification (Noto Sans Telugu)
          </h2>
          <p className="text-xl font-medium text-emerald-950 font-sans lang-te">
            కిరాణా ప్లాట్‌ఫామ్: మీ సమీప కిరాణా దుకాణం నుండి తాజా సరుకులు సులభంగా మరియు వేగంగా
            పొందండి.
          </p>
          <p className="text-xs text-emerald-800 mt-1">
            Line-height: 1.6 enforced for Telugu script.
          </p>
        </section>

        {/* 1. BUTTONS */}
        <Card>
          <h2 className="text-lg font-bold text-ink-900 mb-4 pb-2 border-b border-ink-300/40">
            Buttons (Variants, Sizes & States)
          </h2>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="md">
                Primary md (48px)
              </Button>
              <Button variant="secondary" size="md">
                Secondary md
              </Button>
              <Button variant="danger" size="md">
                Danger md
              </Button>
              <Button variant="ghost" size="md">
                Ghost md
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="lg" rightIcon={ArrowRight}>
                Primary lg (56px)
              </Button>
              <Button variant="secondary" size="lg">
                Secondary lg
              </Button>
              <Button variant="danger" size="lg">
                Danger lg
              </Button>
              <Button variant="ghost" size="lg">
                Ghost lg
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-ink-300/30">
              <Button
                variant="primary"
                loading={btnLoading}
                onClick={() => {
                  setBtnLoading(true);
                  setTimeout(() => setBtnLoading(false), 2000);
                }}
              >
                {btnLoading ? 'Processing...' : 'Click to test Loading state'}
              </Button>
              <Button variant="primary" disabled>
                Disabled Button
              </Button>
            </div>
          </div>
        </Card>

        {/* 2. INPUTS */}
        <Card>
          <h2 className="text-lg font-bold text-ink-900 mb-4 pb-2 border-b border-ink-300/40">
            Inputs (48px Height, Labels & Validation Errors)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Customer Full Name" placeholder="e.g. Ramesh Kumar" />
            <Input label="Search Grocery Items" placeholder="Atta, Dal, Oil..." leftIcon={Search} />
            <Input
              label="Mobile Number"
              placeholder="10-digit number"
              error="Please enter a valid 10-digit phone number"
              defaultValue="98765"
            />
            <Input
              label="Store Email"
              type="email"
              leftIcon={Mail}
              placeholder="store@example.com"
            />
          </div>
        </Card>

        {/* 3. BADGES & CHIPS */}
        <Card>
          <h2 className="text-lg font-bold text-ink-900 mb-4 pb-2 border-b border-ink-300/40">
            Badges (Order Statuses) & Chips (Selectable Pills)
          </h2>

          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase text-ink-600 mb-2">
              Status Badges (11 Workflow States)
            </h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="placed">PLACED</Badge>
              <Badge variant="accepted">ACCEPTED</Badge>
              <Badge variant="packing">PACKING</Badge>
              <Badge variant="ready">READY</Badge>
              <Badge variant="out">OUT FOR DELIVERY</Badge>
              <Badge variant="delivered">DELIVERED</Badge>
              <Badge variant="awaiting_customer">AWAITING CUSTOMER</Badge>
              <Badge variant="rejected">REJECTED</Badge>
              <Badge variant="cancelled">CANCELLED</Badge>
              <Badge variant="expired">EXPIRED</Badge>
              <Badge variant="delivery_failed">DELIVERY FAILED</Badge>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase text-ink-600 mb-2">Selectable Chips</h3>
            <div className="flex flex-wrap gap-2">
              {['groceries', 'dairy', 'snacks', 'beverages', 'staples'].map((cat) => (
                <Chip
                  key={cat}
                  selected={selectedChip === cat}
                  onClick={() => setSelectedChip(cat)}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Chip>
              ))}
            </div>
          </div>
        </Card>

        {/* 4. QUANTITY STEPPER & MODAL SHEET */}
        <Card>
          <h2 className="text-lg font-bold text-ink-900 mb-4 pb-2 border-b border-ink-300/40">
            Quantity Stepper & BottomSheet (Mobile Slide-up / Desktop Modal)
          </h2>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs font-semibold text-ink-600 uppercase mb-2">
                Quantity Stepper (min 0, max 10, 48px touch targets)
              </p>
              <QuantityStepper value={stepperValue} onChange={setStepperValue} min={0} max={10} />
            </div>

            <div className="pt-4 sm:pt-0">
              <p className="text-xs font-semibold text-ink-600 uppercase mb-2">
                Interactive BottomSheet
              </p>
              <Button variant="secondary" onClick={() => setIsSheetOpen(true)}>
                Open BottomSheet
              </Button>
            </div>
          </div>
        </Card>

        {/* 5. TOAST NOTIFICATIONS */}
        <Card>
          <h2 className="text-lg font-bold text-ink-900 mb-4 pb-2 border-b border-ink-300/40">
            Toast System (with Optional Retry Action)
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={handleFireToast}>
              Trigger Info Toast with Action
            </Button>
            <Button variant="danger" leftIcon={RotateCcw} onClick={handleFireErrorToast}>
              Trigger Error Toast with Retry
            </Button>
          </div>
        </Card>

        {/* 6. TIMELINE & SKELETON */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-lg font-bold text-ink-900 mb-4 pb-2 border-b border-ink-300/40">
              Order Timeline (Done / Current / Pending)
            </h2>
            <Timeline steps={sampleTimelineSteps} />
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-ink-900 mb-4 pb-2 border-b border-ink-300/40">
              Skeleton Loading States
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-28 w-full rounded-card" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-10 rounded-xl" />
                <Skeleton className="h-10 rounded-xl" />
              </div>
            </div>
          </Card>
        </div>

        {/* 7. EMPTY STATE */}
        <Card>
          <h2 className="text-lg font-bold text-ink-900 mb-4 pb-2 border-b border-ink-300/40">
            Empty State
          </h2>
          <EmptyState
            icon={ShoppingBag}
            title="Your Cart is Empty"
            text="Explore nearby neighbourhood kirana stores to add daily essentials and snacks to your cart."
            action={
              <Button variant="primary" size="md">
                Browse Nearby Stores
              </Button>
            }
          />
        </Card>
      </div>

      {/* BottomSheet Instance */}
      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="Quick Order Confirmation"
      >
        <div className="space-y-4 text-ink-900">
          <p className="text-sm text-ink-600">
            This BottomSheet slides up smoothly on mobile screens and centers as an accessible modal
            on tablet and desktop screens. It dismisses on backdrop clicks and the Escape key.
          </p>
          <div className="bg-primary-50 p-4 rounded-xl border border-primary-600/20">
            <h4 className="font-semibold text-primary-800 text-sm">
              Pilot Kirana Store: Gudlavalleru
            </h4>
            <p className="text-xs text-primary-700 mt-1">
              Estimated delivery time: 15–25 minutes. Free local delivery.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsSheetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setIsSheetOpen(false);
                showToast({ type: 'success', message: 'Order submitted!' });
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
