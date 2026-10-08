import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Edit2,
  Trash2,
  Plus,
  AlertTriangle,
  Info,
  Scale,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { DetectedFoodItem } from '../types';

interface FoodConfirmationProps {
  initialFoods: DetectedFoodItem[];
  overallConfidence: number;
  uncertainties: string[];
  imageUrl?: string;
  onConfirm: (confirmedFoods: DetectedFoodItem[]) => void;
  onScanAnother: () => void;
}

const getFoodEmoji = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('biryani') || n.includes('rice') || n.includes('pulao')) return '🍚';
  if (n.includes('dosa') || n.includes('crepe')) return '🥞';
  if (n.includes('idli')) return '⚪';
  if (n.includes('vada')) return '🍩';
  if (n.includes('roti') || n.includes('chapati') || n.includes('paratha') || n.includes('naan')) return '🫓';
  if (n.includes('dal') || n.includes('sambar') || n.includes('curry') || n.includes('chole') || n.includes('rajma') || n.includes('gravy')) return '🍲';
  if (n.includes('paneer')) return '🧀';
  if (n.includes('chicken') || n.includes('meat') || n.includes('mutton') || n.includes('fish')) return '🍗';
  if (n.includes('raita') || n.includes('curd') || n.includes('yogurt') || n.includes('milk')) return '🥛';
  if (n.includes('salad') || n.includes('cucumber') || n.includes('vegetable')) return '🥗';
  if (n.includes('sweet') || n.includes('jamun') || n.includes('halwa')) return '🍯';
  if (n.includes('samosa') || n.includes('snack') || n.includes('pakora')) return '🥟';
  return '🍽️';
};

export const FoodConfirmation: React.FC<FoodConfirmationProps> = ({
  initialFoods,
  overallConfidence,
  uncertainties,
  imageUrl,
  onConfirm,
  onScanAnother,
}) => {
  const [foods, setFoods] = useState<DetectedFoodItem[]>(() =>
    initialFoods.map((f, i) => ({
      ...f,
      id: f.id || `food-${i}-${Date.now()}`,
    }))
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPortionValue, setEditPortionValue] = useState<number>(100);
  const [editPortionUnit, setEditPortionUnit] = useState('g');

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPortionValue, setNewPortionValue] = useState<number>(150);
  const [newPortionUnit, setNewPortionUnit] = useState('g');

  const [isConfirmed, setIsConfirmed] = useState(false);

  // Edit item
  const startEdit = (food: DetectedFoodItem) => {
    setEditingId(food.id || '');
    setEditName(food.name);
    setEditPortionValue(food.estimated_portion.value);
    setEditPortionUnit(food.estimated_portion.unit);
  };

  const saveEdit = (id: string) => {
    setFoods((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const rounded = Math.round(editPortionValue);
          return {
            ...f,
            name: editName.trim() || f.name,
            estimated_portion: {
              value: editPortionValue > 0 ? editPortionValue : 100,
              unit: editPortionUnit.trim() || 'g',
              display_text: `~${rounded} ${editPortionUnit}`,
            },
          };
        }
        return f;
      })
    );
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  // Remove item
  const handleRemove = (id: string) => {
    setFoods((prev) => prev.filter((f) => f.id !== id));
  };

  // Add missing item
  const handleAddFood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const rounded = Math.round(newPortionValue);
    const newFood: DetectedFoodItem = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      estimated_portion: {
        value: newPortionValue > 0 ? newPortionValue : 100,
        unit: newPortionUnit.trim() || 'g',
        display_text: `~${rounded} ${newPortionUnit}`,
      },
      confidence: 1.0, // User-confirmed item
      description: 'Added manually by user',
      uncertainties: ['Manual user entry'],
      ingredients: [],
    };

    setFoods((prev) => [...prev, newFood]);
    setNewName('');
    setNewPortionValue(150);
    setNewPortionUnit('g');
    setIsAdding(false);
  };

  const handleConfirmAction = () => {
    setIsConfirmed(true);
    onConfirm(foods);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Multimodal Vision AI Analysis
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Review Detected Foods
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Review and adjust detected foods and portions before passing to the nutrition engine.
          </p>
        </div>

        <button
          onClick={onScanAnother}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          Scan Different Meal
        </button>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Image preview + AI confidence summary */}
        <div className="space-y-4">
          {imageUrl && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-800">Scanned Photograph</span>
                <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium border border-emerald-100">
                  AI Analyzed
                </span>
              </div>
              <img
                src={imageUrl}
                alt="Analyzed food"
                className="w-full h-48 object-cover object-center bg-slate-900/5"
              />
            </div>
          )}

          {/* AI Confidence Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium uppercase tracking-wider text-[11px]">
                Detection Confidence
              </span>
              <span className="font-bold text-slate-900">
                {Math.round(overallConfidence * 100)}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                style={{ width: `${Math.round(overallConfidence * 100)}%` }}
                className={`h-full rounded-full transition-all ${
                  overallConfidence >= 0.8
                    ? 'bg-emerald-500'
                    : overallConfidence >= 0.6
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Confidence is derived from visual clarity, angle, and distinct dish features.
            </p>
          </div>

          {/* Identified Visual Uncertainties */}
          {uncertainties.length > 0 && (
            <div className="rounded-2xl bg-amber-50/70 border border-amber-200/80 p-4 space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Visual Uncertainties Documented</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-amber-800 list-disc list-inside">
                {uncertainties.map((u, i) => (
                  <li key={i} className="leading-relaxed">
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right Column: Detected Foods List (2 Cols wide) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Detected foods</span>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  {foods.length}
                </span>
              </h3>
              <span className="text-xs text-slate-500">
                Audit and edit portions
              </span>
            </div>

            {/* Food items list */}
            {foods.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No food items detected. Click "+ Add food" below to add dishes manually.
              </div>
            ) : (
              <div className="space-y-3">
                {foods.map((food) => {
                  const isEditing = editingId === food.id;

                  return (
                    <div
                      key={food.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors space-y-3"
                    >
                      {isEditing ? (
                        /* Inline Edit Form */
                        <div className="space-y-3 bg-white p-3 rounded-lg border border-emerald-200">
                          <div className="text-xs font-bold text-slate-800">
                            Edit Detected Food
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="sm:col-span-2">
                              <label className="text-[10px] text-slate-500 block mb-0.5">
                                Food Name
                              </label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 block mb-0.5">
                                Portion Value & Unit
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  value={editPortionValue}
                                  onChange={(e) => setEditPortionValue(Number(e.target.value))}
                                  className="w-16 text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-emerald-500"
                                />
                                <input
                                  type="text"
                                  value={editPortionUnit}
                                  onChange={(e) => setEditPortionUnit(e.target.value)}
                                  className="w-14 text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-emerald-500"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEdit(food.id || '')}
                              className="px-3 py-1 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700"
                            >
                              Save Edit
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Standard View Mode matching specification */
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl shrink-0 mt-0.5 select-none">
                              {getFoodEmoji(food.name)}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-900">
                                  {food.name}
                                </h4>
                                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                  {Math.round(food.confidence * 100)}%
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                                <Scale className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-medium text-slate-800">
                                  Estimated: {food.estimated_portion.display_text || `~${food.estimated_portion.value} ${food.estimated_portion.unit}`}
                                </span>
                              </div>

                              {food.description && (
                                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                                  {food.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons: [Edit] [Remove] */}
                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <button
                              type="button"
                              onClick={() => startEdit(food)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemove(food.id || '')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-700 bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* [+ Add food] Button / Form */}
            {!isAdding ? (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-700 hover:border-emerald-500 hover:text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add food
              </button>
            ) : (
              <form
                onSubmit={handleAddFood}
                className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-3"
              >
                <span className="text-xs font-bold text-slate-900 block">
                  Add Missing Food Item
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-600 block mb-0.5">
                      Food Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sambar or Papad"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 block mb-0.5">
                      Estimated Portion
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        value={newPortionValue}
                        onChange={(e) => setNewPortionValue(Number(e.target.value))}
                        className="w-16 text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-emerald-500"
                      />
                      <input
                        type="text"
                        value={newPortionUnit}
                        onChange={(e) => setNewPortionUnit(e.target.value)}
                        className="w-14 text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-emerald-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  >
                    Add to Review
                  </button>
                </div>
              </form>
            )}

            {/* Transition to nutrition intelligence engine */}
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <Info className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium text-slate-700">
                Confirm foods and portions to calculate deterministic nutrition breakdown.
              </span>
            </div>

            {/* [Confirm Foods] Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={foods.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-sm shadow-sm transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Confirm Foods & Calculate Nutrition ({foods.length} item{foods.length === 1 ? '' : 's'})
              </button>
            </div>
          </div>

          {/* Confirmation Success Callout */}
          {isConfirmed && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Foods Confirmed Successfully</span>
              </div>
              <p className="text-emerald-800 leading-relaxed">
                Passing confirmed food items and portions directly to the deterministic nutrition intelligence engine...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
