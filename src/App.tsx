// src/App.tsx
import { useState, useEffect } from 'react'
import './App.css'
import chimpsData from './data/chimps.json'
import towerList from './data/tower_list.json'

interface ChimpsCalcState {
  currentRound: string; // Changed from number to string
  currentMoney: string; // Changed from number to string
  selectedTowers: Set<string>;
}

interface ValidationError {
  field: string;
  message: string;
  
}

interface TowerData {
  name: string;
  data: {
    upgradePaths: {
      path: string;
      upgrades: Array<{
        name: string;
        price: number;
      }>;
    }[];
  };
}


interface Upgrade {
  name: string;
  price: number;
}

interface Path {
  path: string;
  upgrades: Upgrade[];
}
/*
interface AffordableUpgrade {
  tower: string;
  paths: Path[];
}

interface CalculationResult {
  remainingMoney: number;
  earnedSoFar: number;
  affordableUpgrades: AffordableUpgrade[];
}
*/
// Round income data (simplified example)

const TOTAL_CHIMPS_MONEY = 178909.4

const CHIMPS_ROUND_INCOME: Record<number, number> = chimpsData.rounds.reduce(
  (acc, { round, cash_gained }) => ({
    ...acc,
    [round]: cash_gained
  }), 
  {}
);

const CHIMPS_MONEY_REMAIN: Record<number, number> = chimpsData.rounds.reduce(
  (acc, { round, total_money }) => ({
    ...acc,
    [round]: total_money
  }), 
  {}
);

function App() {
  const [state, setState] = useState<ChimpsCalcState>({
    currentRound: '6', // Changed to string
    currentMoney: '650', // Changed to string
    selectedTowers: new Set()
  });

  const [result, setResult] = useState<{
    remainingMoney: number;
    earnedSoFar: number;
    affordableUpgrades: any[];
  } | null>(null);

  const [errors, setErrors] = useState<ValidationError[]>([]);

  const getMoneyGainedForRound = (round: string): number => {
    return CHIMPS_ROUND_INCOME[parseInt(round)] || 0;
  };

  const calculateRemainingMoney = (currentRound: string, currentMoney: string): number => {
    const roundNum = parseInt(currentRound);
    const moneyNum = parseFloat(currentMoney);
    const roundIncome = CHIMPS_MONEY_REMAIN[roundNum - 1] || 0;
    const remainingMoney = (TOTAL_CHIMPS_MONEY - roundIncome) + moneyNum;
    return Math.round(remainingMoney * 100) / 100;
  };

  // Update validation to handle string values
  const validateInputs = (): ValidationError[] => {
    const errors: ValidationError[] = [];
    const roundNum = parseInt(state.currentRound);
    const moneyNum = parseFloat(state.currentMoney);
    
    if (isNaN(roundNum) || roundNum < 6 || roundNum > 100) {
      errors.push({
        field: 'round',
        message: 'Round must be between 6 and 100'
      });
    }
  
    if (isNaN(moneyNum) || moneyNum < 0) {
      errors.push({
        field: 'money',
        message: 'Money cannot be negative'
      });
    }

    if (state.selectedTowers.size === 0) {
      errors.push({
        field: 'tower',
        message: 'Please select at least one tower'
      });
    }
  
    return errors;
  };

  // Add tower toggle function
  const toggleTower = (towerName: string) => {
    setState(prev => {
      const newSelected = new Set(prev.selectedTowers);
      if (newSelected.has(towerName)) {
        newSelected.delete(towerName);
      } else {
        newSelected.add(towerName);
      }
      return {
        ...prev,
        selectedTowers: newSelected
      };
    });
  };

  // Update useEffect to include validation
  useEffect(() => {
    const validationErrors = validateInputs();
    setErrors(validationErrors);

    if (validationErrors.length === 0) {
      const remaining = calculateRemainingMoney(state.currentRound, state.currentMoney);
      const earned = getMoneyGainedForRound(state.currentRound);

      const resultData = {
        remainingMoney: remaining,
        earnedSoFar: earned,
        affordableUpgrades: []
      };

      const towerPromises = Array.from(state.selectedTowers)
        .map(towerName => {
          const towerInfo = towerList.towers.find(tower => tower.name === towerName);
          if (!towerInfo) return null;
          
          return fetch(towerInfo.file)
            .then(response => {
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              return response.json();
            })
            .then(towerData => ({
              name: towerName,
              data: towerData
            }))
            .catch(error => {
              console.error(`Error fetching tower ${towerName}:`, error);
              return null;
            });
        })
        .filter((promise): promise is Promise<TowerData> => promise !== null);

      Promise.all(towerPromises)
        .then(towersData => {
          const affordableUpgrades = towersData
            .filter((data): data is TowerData => data !== null)
            .map(towerData => {
              const upgrades = towerData.data.upgradePaths
                .map(path => {
                  const affordableUpgradesInPath = path.upgrades
                    .filter(upgrade => upgrade.price <= remaining);
                  
                  return affordableUpgradesInPath.length > 0 
                    ? { path: path.path, upgrades: affordableUpgradesInPath }
                    : null;
                })
                .filter(Boolean);

              return {
                tower: towerData.name,
                paths: upgrades
              };
            });

          setResult({
            ...resultData,
            affordableUpgrades
          });
        })
        .catch(error => {
          console.error('Error processing tower data:', error);
          setResult(resultData);
        });
    } else {
      setResult(null);
    }
  }, [state]);

  return (
    <div className="container">
      <h1>BTD6 CHIMPS/IMPOPPABLE Calculator</h1>
      
      <div className="calc-form">
        <div className="input-group">
          <label htmlFor="round">Current Round:</label>
          <input
            type="number"
            id="round"
            value={state.currentRound}
            onChange={(e) => setState({
              ...state,
              currentRound: e.target.value
            })}
            onBlur={(e) => {
              const value = parseInt(e.target.value);
              if (!isNaN(value)) {
                setState({
                  ...state,
                  currentRound: Math.max(6, Math.min(100, value)).toString()
                });
              } else {
                setState({
                  ...state,
                  currentRound: '6'
                });
              }
            }}
            className={errors.some(e => e.field === 'round') ? 'error' : ''}
          />
        </div>
        <div className="input-group">
          <label htmlFor="money">Current Money:</label>
          <input
            type="number"
            id="money"
            value={state.currentMoney}
            onChange={(e) => setState({
              ...state,
              currentMoney: e.target.value
            })}
            onBlur={(e) => {
              const value = parseFloat(e.target.value);
              setState({
                ...state,
                currentMoney: isNaN(value) ? '0' : value.toString()
              });
            }}
            className={errors.some(e => e.field === 'money') ? 'error' : ''}
          />
        </div>
        <div className="input-group">
          <label htmlFor="tower">Select Tower:</label>
          <div className="tower-grid">
            {towerList.towers.map((tower) => (
              <button
                key={tower.name}
                onClick={() => toggleTower(tower.name)}
                className={`tower-button ${state.selectedTowers.has(tower.name) ? 'selected' : ''}`}
              >
                {tower.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="errors">
          {errors.map((error, index) => (
            <p key={index} className="error-message">
              {error.message}
            </p>
          ))}
        </div>
      )}


{result && (
  <div className="results">
    <h3>Results:</h3>
    <p>Money Earned This Round: ${result.earnedSoFar}</p>
    <p>Remaining Money Until Round 100: ${result.remainingMoney}</p>
    {result.affordableUpgrades && (
      <div className="available-upgrades">
        <h4>Available Upgrades:</h4>
        {result.affordableUpgrades.length > 0 ? (
          result.affordableUpgrades.map((towerData, index) => (
            <div key={index} className="tower-upgrades">
              <h5>{towerData.tower}</h5>
              {towerData.paths.map((path: Path, pathIndex: number) => (
                <div key={pathIndex} className="upgrade-path">
                  <h6>{path.path}</h6>
                  <ul>
                    {path.upgrades.map((upgrade: Upgrade, upgradeIndex: number) => (
                      <li key={upgradeIndex}>
                        {upgrade.name} - ${upgrade.price}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))
        ) : (
          <p>No upgrades available with the remaining money.</p>
        )}
      </div>
    )}
  </div>
)}

    </div>
  );
}

export default App