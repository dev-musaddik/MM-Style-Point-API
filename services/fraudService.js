const synaptic = require('synaptic');
const { Layer, Network, Trainer } = synaptic;

class FraudService {
  constructor() {
    // Create a simple Perceptron: 3 inputs, 4 hidden, 1 output
    const inputLayer = new Layer(3);
    const hiddenLayer = new Layer(4);
    const outputLayer = new Layer(1);

    inputLayer.project(hiddenLayer);
    hiddenLayer.project(outputLayer);

    this.net = new Network({
      input: inputLayer,
      hidden: [hiddenLayer],
      output: outputLayer
    });

    this.isTrained = false;
    this.trainModel();
  }

  trainModel() {
    const trainer = new Trainer(this.net);
    
    // Synthetic training data
    // Input: [amount (0-1), isNewIp (0/1), orderFrequency (0-1)]
    // Output: [fraudScore (0-1)]
    const trainingSet = [
      // Normal behavior
      { input: [0.1, 0, 0.1], output: [0] },
      { input: [0.2, 0, 0.2], output: [0.1] },
      { input: [0.1, 1, 0.1], output: [0.2] },
      
      // Suspicious behavior
      { input: [0.9, 1, 0.1], output: [0.8] }, // High amount, new IP
      { input: [0.1, 0, 0.9], output: [0.7] }, // High frequency
      { input: [0.8, 0, 0.8], output: [0.9] }, // High amount, high frequency
      { input: [0.95, 1, 0.9], output: [0.99] } // Extreme case
    ];

    trainer.train(trainingSet, {
      rate: 0.1,
      iterations: 2000,
      error: 0.005,
      shuffle: true,
      log: 0,
    });

    this.isTrained = true;
    console.log('Fraud detection model trained (Synaptic)');
  }

  /**
   * Analyze a transaction for fraud risk
   * @param {Object} orderData - { totalAmount, ipAddress }
   * @param {Object} userHistory - { loginHistory, previousOrders }
   * @returns {Object} { score, reason }
   */
  analyzeTransaction(orderData, userHistory = {}) {
    if (!this.isTrained) {
      this.trainModel();
    }

    // Normalize inputs
    // Assuming max normal order is around 10000, cap at 20000 for normalization
    const normalizedAmount = Math.min(orderData.totalAmount / 20000, 1);
    
    // Check if IP is new
    const knownIps = userHistory.loginHistory ? userHistory.loginHistory.map(h => h.ip) : [];
    const isNewIp = knownIps.includes(orderData.ipAddress) ? 0 : 1;

    // Order frequency (simplified)
    const orderFrequency = 0.2; // Default low frequency for now

    const result = this.net.activate([normalizedAmount, isNewIp, orderFrequency]);
    const score = result[0];

    let reason = 'Low risk';

    if (score > 0.8) reason = 'High Risk: Unusual pattern detected';
    else if (score > 0.5) reason = 'Medium Risk: Monitor activity';
    else if (isNewIp && normalizedAmount > 0.5) reason = 'New IP with high amount';

    return {
      score: parseFloat(score.toFixed(2)),
      reason
    };
  }
}

module.exports = new FraudService();
