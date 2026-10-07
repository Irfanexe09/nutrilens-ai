import React, { useState } from 'react';
import { Search, Database, ChevronRight } from 'lucide-react';
import { FoodItem } from '../types';

interface FoodCatalogProps {
  foods: FoodItem[];
  onSelectForMeal: (food: FoodItem) => void;
}

export const FoodCatalog: React.FC<FoodCatalogProps> = ({ foods, onSelectForMeal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(foods.map((f) => f.category)))];

  const filtered = foods.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.local_name && f.local_name.includes(searchTerm)) ||
      f.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || f.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 mb-2">
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            Verified Indian Food Intelligence
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Indian Food Database Explorer
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Deterministic macronutrient baseline profiles with recipe variance margins for authentic regional dishes.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Biryani, Dosa, Dal..."
            className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Dishes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((food) => (
          <div
            key={food.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">{food.name}</h3>
                  {food.local_name && (
                    <span className="text-xs text-slate-500 font-medium">{food.local_name}</span>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  {food.category}
                </span>
              </div>

              {food.description && (
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {food.description}
                </p>
              )}

              {/* Serving details */}
              <div className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg">
                Serving: {food.serving_size} {food.serving_unit} • Variance: ±{food.uncertainty_pct}%
              </div>
            </div>

            {/* Macro Stats */}
            <div className="pt-4 mt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xl font-extrabold text-slate-900">{food.calories}</span>
                  <span className="text-xs text-slate-500 font-medium ml-1">kcal</span>
                </div>
                <button
                  onClick={() => onSelectForMeal(food)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Analyze in Meal
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-1.5 rounded-lg bg-slate-50">
                  <span className="text-[10px] text-slate-400 block font-medium">Protein</span>
                  <span className="font-bold text-slate-800">{food.protein}g</span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-50">
                  <span className="text-[10px] text-slate-400 block font-medium">Carbs</span>
                  <span className="font-bold text-slate-800">{food.carbohydrates}g</span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-50">
                  <span className="text-[10px] text-slate-400 block font-medium">Fat</span>
                  <span className="font-bold text-slate-800">{food.fat}g</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
