import React, { useState, useEffect } from 'react';
import { currencyFormat } from '../../utils/formatCurrency';
import { 
  FaBoxOpen,
  FaThumbsUp,
  FaArrowUp, 
  FaExclamationTriangle, 
  FaInfoCircle, 
  FaTimes,
  FaCalendarAlt,
  FaChartLine
} from 'react-icons/fa';

const RestockSuggestionsDialog = ({ 
  isOpen, 
  onClose, 
  forecastData, 
  actualData, 
  topProducts,
  salesInterval,
  categoryName,
  selectedProductName 
}) => {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (isOpen && (forecastData?.length > 0 || actualData?.length > 0)) {
      generateSuggestions();
    }
  }, [isOpen, forecastData, actualData, topProducts, salesInterval, categoryName, selectedProductName]);

  const generateSuggestions = () => {
    const newSuggestions = [];
    
  // FILTER FORECAST DATA TO GET ONLY FUTURE PREDICTIONS
    const forecastPeriods = forecastData?.filter(item => item.forecast_units > 0) || [];
    const actualPeriods = actualData || [];
    
    if (selectedProductName && topProducts?.length > 0) {
  // SINGLE PRODUCT ANALYSIS
      const product = topProducts.find(p => p.product_name === selectedProductName);
      if (product) {
        const productSuggestions = analyzeProductDemand(product, forecastPeriods, actualPeriods);
        newSuggestions.push(...productSuggestions);
      }
    } else {
  // CATEGORY OR ALL PRODUCTS ANALYSIS
      const categoryAnalysis = analyzeCategoryDemand(topProducts, forecastPeriods, actualPeriods);
      newSuggestions.push(...categoryAnalysis);
    }

    setSuggestions(newSuggestions);
  };

  const analyzeProductDemand = (product, forecastPeriods, actualPeriods) => {
    const suggestions = [];
    
  // CALCULATE AVERAGE FORECAST DEMAND
    const avgForecastDemand = forecastPeriods.length > 0 
      ? forecastPeriods.reduce((sum, item) => sum + (item.forecast_units || 0), 0) / forecastPeriods.length 
      : 0;

  // CALCULATE RECENT ACTUAL DEMAND TREND
  const recentActual = actualPeriods.slice(-3); // LAST 3 PERIODS
    const avgRecentDemand = recentActual.length > 0
      ? recentActual.reduce((sum, item) => sum + (item.units_sold || 0), 0) / recentActual.length
      : 0;

  // CALCULATE TREND DIRECTION AND STRENGTH
    const isIncreasingTrend = forecastPeriods.length >= 2 && 
      forecastPeriods[forecastPeriods.length - 1]?.forecast_units > forecastPeriods[0]?.forecast_units;
    
    const trendStrength = forecastPeriods.length >= 2 
      ? Math.abs(((forecastPeriods[forecastPeriods.length - 1]?.forecast_units || 0) / Math.max(forecastPeriods[0]?.forecast_units || 1, 1) - 1) * 100)
      : 0;

  // GENERATE SUGGESTIONS BASED ON INTERVAL
    const intervalMultiplier = getIntervalMultiplier(salesInterval);
    const baseQuantity = Math.max(avgForecastDemand, avgRecentDemand);
  const bufferPercentage = trendStrength > 20 ? 1.5 : 1.2; // HIGHER BUFFER FOR STRONG TRENDS
    const suggestedQuantity = Math.ceil(baseQuantity * intervalMultiplier * bufferPercentage);

    if (baseQuantity > 0) {
      suggestions.push({
        type: isIncreasingTrend && trendStrength > 15 ? 'high_priority' : 'normal',
        icon: isIncreasingTrend ? FaArrowUp : FaBoxOpen,
        title: `${product.product_name} - ${isIncreasingTrend && trendStrength > 15 ? 'High Growth Expected' : 'Standard Replenishment'}`,
        message: `Based on ${salesInterval} analysis: ${Math.ceil(baseQuantity)} units per ${salesInterval.slice(0, -2)} average`,
        recommendation: `Restock ${suggestedQuantity.toLocaleString()} units (${Math.ceil(intervalMultiplier)}-${salesInterval.slice(0, -2)} supply)`,
        urgency: isIncreasingTrend && trendStrength > 20 ? 'high' : trendStrength > 10 ? 'medium' : 'low',
        confidence: calculateConfidence(forecastPeriods, actualPeriods)
      });
    }

  // CHECK FOR SEASONAL PATTERNS OR LOW STOCK WARNINGS
    if (avgRecentDemand > avgForecastDemand * 1.5) {
      suggestions.push({
        type: 'warning',
        icon: FaExclamationTriangle,
        title: `${product.product_name} - Recent Surge Detected`,
        message: `Recent demand (${Math.ceil(avgRecentDemand)} units) exceeds forecast predictions`,
        recommendation: `Consider emergency restock of ${Math.ceil(avgRecentDemand * intervalMultiplier * 1.5)} units`,
        urgency: 'high',
        confidence: 'medium'
      });
    }

    return suggestions;
  };

  const analyzeCategoryDemand = (products, forecastPeriods, actualPeriods) => {
    const suggestions = [];
    
    if (!products || products.length === 0) return suggestions;

  // ANALYZE TOP PERFORMERS WITH MORE SOPHISTICATED METRICS
    const topPerformers = products.slice(0, Math.min(5, products.length));
    const intervalMultiplier = getIntervalMultiplier(salesInterval);
    
  // CALCULATE TOTAL CATEGORY SALES FOR RELATIVE PERFORMANCE
    const totalCategorySales = products.reduce((sum, p) => sum + (p.sales_amount || 0), 0);

    topPerformers.forEach((product, index) => {
      const estimatedDemand = estimateProductDemand(product, forecastPeriods, actualPeriods);
      const marketShare = totalCategorySales > 0 ? ((product.sales_amount || 0) / totalCategorySales) * 100 : 0;
      const suggestedQuantity = Math.ceil(estimatedDemand * intervalMultiplier * (1.1 + (marketShare / 100))); // Higher buffer for high-share products

      if (estimatedDemand > 0) {
        const priorityLevel = index === 0 ? 'high_priority' : index < 3 ? 'normal' : 'low_priority';
        
        suggestions.push({
          type: priorityLevel,
          icon: index === 0 ? FaArrowUp : FaBoxOpen,
          title: `${product.product_name} - ${index === 0 ? 'Top Revenue Generator' : `#${index + 1} Performer`}`,
          message: `${marketShare.toFixed(1)}% of category sales • ~${Math.ceil(estimatedDemand)} units per ${salesInterval.slice(0, -2)}`,
          recommendation: `${index === 0 ? 'Priority' : 'Standard'} restock: ${suggestedQuantity.toLocaleString()} units`,
          urgency: index === 0 ? 'high' : index < 3 ? 'medium' : 'low',
          confidence: marketShare > 10 ? 'high' : marketShare > 5 ? 'medium' : 'low'
        });
      }
    });

    // Category insights and alerts
    const avgSalesPerProduct = totalCategorySales / products.length;
    const highPerformers = products.filter(p => (p.sales_amount || 0) > avgSalesPerProduct * 1.5);
    const lowPerformers = products.filter(p => (p.sales_amount || 0) < avgSalesPerProduct * 0.3);

  // HIGH PERFORMER ALERT
    if (highPerformers.length > 0) {
      suggestions.push({
        type: 'info',
        icon: FaArrowUp,
        title: `${categoryName} - High Performers Identified`,
        message: `${highPerformers.length} products performing 50%+ above category average`,
        recommendation: `Focus restocking budget on these ${highPerformers.length} high-demand items`,
        urgency: 'medium',
        confidence: 'high'
      });
    }

  // CATEGORY-WIDE BUDGET PLANNING
    if (forecastPeriods.length > 0) {
      const avgUnitCost = 75; // Estimated average unit cost
      const estimatedTotalUnits = products.reduce((sum, product) => 
        sum + estimateProductDemand(product, forecastPeriods, actualPeriods), 0
      );
      const budgetEstimate = estimatedTotalUnits * intervalMultiplier * avgUnitCost;

      suggestions.push({
        type: 'info',
        icon: FaChartLine,
        title: `${categoryName} - Budget Planning`,
        message: `Estimated ${Math.ceil(estimatedTotalUnits * intervalMultiplier).toLocaleString()} total units needed for ${intervalMultiplier}-${salesInterval.slice(0, -2)} coverage`,
        recommendation: `Allocate approximately ${currencyFormat(budgetEstimate)} for category restocking`,
        urgency: 'low',
        confidence: 'medium'
      });
    }

  // LOW PERFORMER WARNING
    if (lowPerformers.length > products.length * 0.3) {
      suggestions.push({
        type: 'warning',
        icon: FaExclamationTriangle,
        title: `${categoryName} - Inventory Optimization Opportunity`,
        message: `${lowPerformers.length} products underperforming (70% below average)`,
        recommendation: `Consider reducing stock levels or discontinuing slow-moving items`,
        urgency: 'low',
        confidence: 'medium'
      });
    }

    return suggestions;
  };

  const estimateProductDemand = (product, forecastPeriods, actualPeriods) => {
    // USE UNITS_SOLD IF AVAILABLE FROM TOPPRODUCTS DATA
    const actualUnits = product.units_sold || 0;
    
    // CALCULATE DEMAND FROM SALES AMOUNT (FALLBACK METHOD)
    const avgUnitPrice = Math.max((product.sales_amount || 0) / Math.max(actualUnits, 1), 50); // Min ₱50 per unit
    const estimatedUnitsFromSales = actualUnits > 0 ? actualUnits : (product.sales_amount || 0) / avgUnitPrice;
    
    // IF WE HAVE FORECAST DATA, BLEND IT WITH HISTORICAL DATA
    if (forecastPeriods.length > 0) {
      const avgForecast = forecastPeriods.reduce((sum, item) => sum + (item.forecast_units || 0), 0) / forecastPeriods.length;
  // WEIGHT FORECAST 70%, HISTORICAL 30% FOR BALANCED PREDICTION
      return (avgForecast * 0.7) + (estimatedUnitsFromSales * 0.3);
    }

    // FALLBACK TO SALES-BASED ESTIMATION WITH TREND ADJUSTMENT
    const intervalAdjustment = salesInterval === 'daily' ? 0.8 : salesInterval === 'weekly' ? 0.9 : 1.0;
    return estimatedUnitsFromSales * intervalAdjustment;
  };

  const getIntervalMultiplier = (interval) => {
    switch (interval) {
  case 'daily': return 7; // WEEK'S WORTH
  case 'weekly': return 4; // MONTH'S WORTH  
  case 'monthly': return 3; // QUARTER'S WORTH
  case 'yearly': return 1; // YEAR'S WORTH
      default: return 2;
    }
  };

  const calculateConfidence = (forecastData, actualData) => {
    if (forecastData.length === 0) return 'low';
    if (actualData.length < 3) return 'medium';
    
  // SIMPLE CONFIDENCE CALCULATION BASED ON DATA AVAILABILITY
    const dataPoints = forecastData.length + actualData.length;
    if (dataPoints > 10) return 'high';
    if (dataPoints > 5) return 'medium';
    return 'low';
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'high_priority': return 'text-red-500';
      case 'warning': return 'text-orange-500';
      case 'info': return 'text-blue-500';
      default: return 'text-green-500';
    }
  };

  if (!isOpen) return null;

  // INLINE CSS TO HIDE SCROLLBAR ACROSS BROWSERS FOR THE DIALOG CONTENT
  const hideScrollbarStyles = `
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    .hide-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
  `;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl">
  {/* HEADER */}
        <div className="p-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
            
              <div>
                <h2 className="text-xl font-bold">Restocking Suggestions</h2>
                <p className="text-sm">
                  Recommendations for {selectedProductName || categoryName} • {salesInterval} analysis
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className=" hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            >
              <FaTimes size={20} />
            </button>
          </div>
        </div>

  {/* CONTENT */}
  <style>{hideScrollbarStyles}</style>
  <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] hide-scrollbar">
          {suggestions.length === 0 ? (
            <div className="text-center py-12">
              <FaInfoCircle className="text-4xl text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No restocking suggestions available</p>
              <p className="text-sm text-gray-500">
                Ensure you have demand forecasting data and sales history to generate recommendations.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* SUMMARY STATS */}
              <h3 className="font-semibold text-gray-700 mb-2">Analysis Summary</h3>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Analysis Period:</span>
                    <div className="font-medium">{salesInterval} intervals</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Focus:</span>
                    <div className="font-medium">{selectedProductName || categoryName}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Suggestions:</span>
                    <div className="font-medium">{suggestions.length} recommendations</div>
                  </div>
                </div>
              </div>

              {/* SUGGESTIONS LIST */}
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${getUrgencyColor(suggestion.urgency)}`}
                >
                  <div className="flex items-start">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-800">{suggestion.title}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          suggestion.urgency === 'high' ? 'bg-red-100 text-red-800' :
                          suggestion.urgency === 'medium' ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {suggestion.urgency.toUpperCase()} PRIORITY
                        </span>
                      </div>
                      <p className="text-gray-700 mb-3">{suggestion.message}</p>
                      
                      <div className="mb-3 text-sm">
                        <div className="bg-white bg-opacity-60 rounded p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FaThumbsUp className="text-blue-600" />
                            <div>
                              <span className="font-medium text-gray-800 block">Recommendation:</span>
                              <div className="text-gray-700 font-medium">{suggestion.recommendation}</div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-gray-600 block">Confidence:</span>
                            <div className={`font-medium ${
                              suggestion.confidence === 'high' ? 'text-green-600' :
                              suggestion.confidence === 'medium' ? 'text-orange-600' :
                              'text-gray-600'
                            }`}>
                              {suggestion.confidence.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                  </div>


                </div>


              ))}

            </div>

          )}

        </div>

      </div>

    </div>

  );

};

export default RestockSuggestionsDialog;