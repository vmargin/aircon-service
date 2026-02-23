import { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Clock,
  Building,
  Wrench,
  FileText
} from 'lucide-react';
import api from '../api/api';
import type { PublicBranch } from '../types';

const PublicBooking = () => {
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    address: '',
    serviceType: '',
    scheduledAt: '',
    branchId: '',
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data } = await api.get<PublicBranch[]>('/public/branches');
        setBranches(data);
      } catch {
        setError('Failed to load branches. Please try again later.');
      } finally {
        setLoadingBranches(false);
      }
    };
    fetchBranches();
  }, []);

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const getFieldError = (field: string) => {
    if (!touched[field]) return null;
    if (!form[field as keyof typeof form]) return 'This field is required';
    if (field === 'phone' && !/^\+?[\d\s-]{10,}$/.test(form.phone)) {
      return 'Please enter a valid phone number';
    }
    return null;
  };

  const getStepValidation = () => {
    switch (currentStep) {
      case 1:
        return form.customerName && form.phone && !getFieldError('phone');
      case 2:
        return form.serviceType && form.branchId;
      case 3:
        return form.scheduledAt && form.address;
      default:
        return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.post('/public/bookings', form);
      setSubmitted(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to submit booking.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps && getStepValidation()) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-8">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-3">Booking Received!</h1>
          <p className="text-slate-500 text-sm mb-2">
            We have received your request for {form.serviceType} service.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-slate-600 mb-1"><span className="font-bold">Name:</span> {form.customerName}</p>
            <p className="text-sm text-slate-600 mb-1"><span className="font-bold">Phone:</span> {form.phone}</p>
            <p className="text-sm text-slate-600"><span className="font-bold">Date:</span> {form.scheduledAt ? new Date(form.scheduledAt).toLocaleString() : 'Not set'}</p>
          </div>
          <p className="text-slate-400 text-xs">
            A technician will contact you within 24 hours to confirm your appointment.
          </p>
        </div>
      </div>
    );
  }

  const serviceTypes = [
    { value: 'Cleaning', label: 'Aircon Cleaning', icon: '🧹' },
    { value: 'Repair', label: 'Aircon Repair', icon: '🔧' },
    { value: 'Installation', label: 'New Installation', icon: '🏠' },
    { value: 'Maintenance', label: 'Scheduled Maintenance', icon: '📅' },
    { value: 'Check-up', label: 'General Check-up', icon: '🔍' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="h-24 bg-gradient-to-r from-blue-600 to-emerald-600 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            <div className="relative text-center">
              <h1 className="text-2xl font-black text-white mb-1">Book Aircon Service</h1>
              <p className="text-white/90 text-sm">Professional installation, repair & maintenance</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="px-8 pt-6">
            <div className="flex items-center justify-between mb-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                    step === currentStep
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                      : step < currentStep
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    {step < currentStep ? <CheckCircle2 className="w-5 h-5" /> : step}
                  </div>
                  {step < 3 && (
                    <div className={`w-20 h-1 mx-2 rounded-full transition-all duration-300 ${
                      step < currentStep ? 'bg-emerald-500' : 'bg-slate-100'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs font-medium text-slate-400 mb-6">
              <span className={currentStep === 1 ? 'text-blue-600 font-bold' : ''}>Your Details</span>
              <span className={currentStep === 2 ? 'text-blue-600 font-bold' : ''}>Service</span>
              <span className={currentStep === 3 ? 'text-blue-600 font-bold' : ''}>Schedule</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-8 mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 animate-in fade-in duration-300">
              <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-rose-700">{error}</p>
              </div>
            </div>
          )}

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-6">
            {/* Step 1: Customer Details */}
            {currentStep === 1 && (
              <div className="space-y-5 animate-in fade-in duration-300">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
