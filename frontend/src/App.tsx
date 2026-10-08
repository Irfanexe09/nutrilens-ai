import React, { useState, useEffect } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { Hero } from './components/Hero';
import { ScanFood } from './components/ScanFood';
import { AnalysisResult } from './components/AnalysisResult';
import { FoodCatalog } from './components/FoodCatalog';
import { Dashboard } from './components/Dashboard';
import { Profile } from './components/Profile';
import { Footer } from './components/Footer';
import { api } from './services/api';
import { HealthStatus, FoodItem, MealItem, FoodAnalysisResponse, DetectedFoodItem } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [availableFoods, setAvailableFoods] = useState<FoodItem[]>([]);
  const [, setAnalysisResult] = useState<FoodAnalysisResponse | null>(null);
  const [activeMealItems, setActiveMealItems] = useState<MealItem[]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | undefined>(undefined);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    // Check API and Database Health
    api.getHealth().then((res) => setHealth(res));

    // Load available foods catalog
    api.getFoods().then((res) => setAvailableFoods(res.items)).catch(() => {});
  }, []);

  // Handler for demo button (Chicken Biryani + Raita example from product requirements)
  const handleLaunchDemo = () => {
    const biryaniFood = availableFoods.find((f) => f.name.includes('Chicken Biryani')) || {
      id: 1,
      name: 'Chicken Biryani',
      category: 'Rice Dish',
      serving_size: 350.0,
      serving_unit: 'plate',
      calories: 540.0,
      protein: 28.5,
      carbohydrates: 65.0,
      fat: 18.0,
      fiber: 3.8,
      uncertainty_pct: 12.0,
      is_indian_dish: true,
      sugar: 2.1,
      sodium: 780.0,
    };

    const raitaFood = availableFoods.find((f) => f.name.includes('Raita')) || {
      id: 2,
      name: 'Cucumber Raita',
      category: 'Side Dish',
      serving_size: 120.0,
      serving_unit: 'bowl',
      calories: 75.0,
      protein: 4.2,
      carbohydrates: 6.8,
      fat: 3.4,
      fiber: 0.8,
      uncertainty_pct: 6.0,
      is_indian_dish: true,
      sugar: 4.8,
      sodium: 180.0,
    };

    const demoMealItems: MealItem[] = [
      {
        food_id: biryaniFood.id,
        food_name: biryaniFood.name,
        serving_count: 1.0,
        serving_size: biryaniFood.serving_size,
        serving_unit: biryaniFood.serving_unit,
        calories: biryaniFood.calories,
        protein: biryaniFood.protein,
        carbohydrates: biryaniFood.carbohydrates,
        fat: biryaniFood.fat,
        fiber: biryaniFood.fiber,
        uncertainty_pct: biryaniFood.uncertainty_pct,
      },
      {
        food_id: raitaFood.id,
        food_name: raitaFood.name,
        serving_count: 1.0,
        serving_size: raitaFood.serving_size,
        serving_unit: raitaFood.serving_unit,
        calories: raitaFood.calories,
        protein: raitaFood.protein,
        carbohydrates: raitaFood.carbohydrates,
        fat: raitaFood.fat,
        fiber: raitaFood.fiber,
        uncertainty_pct: raitaFood.uncertainty_pct,
      },
    ];

    setActiveMealItems(demoMealItems);
    setIsDemoMode(true);
    setPreviewImageUrl(undefined);
    setActiveTab('demo');
  };

  const handleAnalysisCompleted = (
    result: FoodAnalysisResponse,
    previewUrl: string,
    _file: File,
    confirmedFoods: DetectedFoodItem[]
  ) => {
    setAnalysisResult(result);
    setPreviewImageUrl(previewUrl);
    setIsDemoMode(false);

    // Map confirmed food items to meal items
    const mealItems: MealItem[] = confirmedFoods.map((cf) => {
      const matched = availableFoods.find(
        (af) =>
          af.name.toLowerCase().includes(cf.name.toLowerCase()) ||
          cf.name.toLowerCase().includes(af.name.toLowerCase())
      );

      if (matched) {
        const ratio =
          matched.serving_size > 0
            ? cf.estimated_portion.value / matched.serving_size
            : 1.0;
        return {
          food_id: matched.id,
          food_name: cf.name,
          portion_value: cf.estimated_portion.value,
          portion_unit: cf.estimated_portion.unit,
          gram_weight: cf.estimated_portion.value,
          serving_count: Number(ratio.toFixed(2)) || 1.0,
          serving_size: matched.serving_size,
          serving_unit: matched.serving_unit,
          calories: matched.calories,
          protein: matched.protein,
          carbohydrates: matched.carbohydrates,
          fat: matched.fat,
          fiber: matched.fiber,
          sugar: matched.sugar,
          sodium: matched.sodium,
          confidence_score: cf.confidence,
          confidence_level: cf.confidence >= 0.85 ? 'HIGH' : 'MEDIUM',
          uncertainty_pct: matched.uncertainty_pct,
        };
      }

      return {
        food_id: undefined,
        food_name: cf.name,
        portion_value: cf.estimated_portion.value,
        portion_unit: cf.estimated_portion.unit,
        gram_weight: cf.estimated_portion.value,
        serving_count: 1.0,
        serving_size: cf.estimated_portion.value,
        serving_unit: cf.estimated_portion.unit,
        calories: 150.0,
        protein: 5.0,
        carbohydrates: 20.0,
        fat: 5.0,
        fiber: 2.0,
        sugar: 1.0,
        sodium: 200.0,
        confidence_score: cf.confidence,
        confidence_level: 'LOW',
        uncertainty_pct: 12.0,
      };
    });

    setActiveMealItems(mealItems);
    setActiveTab('demo');
  };

  const handleSelectFromCatalog = (food: FoodItem) => {
    setActiveMealItems([
      {
        food_id: food.id,
        food_name: food.name,
        serving_count: 1.0,
        serving_size: food.serving_size,
        serving_unit: food.serving_unit,
        calories: food.calories,
        protein: food.protein,
        carbohydrates: food.carbohydrates,
        fat: food.fat,
        fiber: food.fiber,
        uncertainty_pct: food.uncertainty_pct,
      },
    ]);
    setIsDemoMode(false);
    setPreviewImageUrl(undefined);
    setActiveTab('demo');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} health={health} />

      <main className="flex-1">
        {activeTab === 'home' && (
          <Hero
            onScanClick={() => setActiveTab('scan')}
            onDemoClick={handleLaunchDemo}
            onCatalogClick={() => setActiveTab('catalog')}
          />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            onLogMealClick={() => setActiveTab('scan')}
            onConfigureProfileClick={() => setActiveTab('profile')}
          />
        )}

        {activeTab === 'profile' && (
          <Profile onProfileUpdated={() => {}} />
        )}

        {activeTab === 'scan' && (
          <ScanFood
            onAnalysisComplete={handleAnalysisCompleted}
            onExploreDemo={handleLaunchDemo}
          />
        )}

        {activeTab === 'demo' && (
          <AnalysisResult
            initialItems={activeMealItems}
            previewImageUrl={previewImageUrl}
            isDemo={isDemoMode}
            onScanAnother={() => setActiveTab('scan')}
            availableFoods={availableFoods}
          />
        )}

        {activeTab === 'catalog' && (
          <FoodCatalog
            foods={availableFoods}
            onSelectForMeal={handleSelectFromCatalog}
          />
        )}
      </main>

      <Footer />
    </div>
  );
};
