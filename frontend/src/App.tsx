import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ScanFood } from './components/ScanFood';
import { AnalysisResult } from './components/AnalysisResult';
import { FoodCatalog } from './components/FoodCatalog';
import { Footer } from './components/Footer';
import { api } from './services/api';
import { HealthStatus, FoodItem, MealItem, FoodAnalysisResponse } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'scan' | 'demo' | 'catalog'>('home');
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
    file: File
  ) => {
    setAnalysisResult(result);
    setPreviewImageUrl(previewUrl);
    setIsDemoMode(false);

    // If candidate dish matches by name from filename, auto-suggest it, else give standard starting selection
    const filename = file.name.toLowerCase();
    let initialItem: FoodItem | undefined;

    if (filename.includes('dosa')) {
      initialItem = availableFoods.find((f) => f.name.includes('Dosa'));
    } else if (filename.includes('biryani')) {
      initialItem = availableFoods.find((f) => f.name.includes('Biryani'));
    } else if (filename.includes('roti') || filename.includes('chapati')) {
      initialItem = availableFoods.find((f) => f.name.includes('Chapati'));
    } else {
      // Pick first seeded item or fallback
      initialItem = availableFoods[0];
    }

    if (initialItem) {
      setActiveMealItems([
        {
          food_id: initialItem.id,
          food_name: initialItem.name,
          serving_count: 1.0,
          serving_size: initialItem.serving_size,
          serving_unit: initialItem.serving_unit,
          calories: initialItem.calories,
          protein: initialItem.protein,
          carbohydrates: initialItem.carbohydrates,
          fat: initialItem.fat,
          fiber: initialItem.fiber,
          uncertainty_pct: initialItem.uncertainty_pct,
        },
      ]);
    } else {
      setActiveMealItems([]);
    }

    setActiveTab('demo'); // Switch to results view
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
