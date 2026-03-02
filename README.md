# CloudMind AI: Autonomous Cloud Optimization Simulation Platform

## 🌐 Overview
CloudMind AI is a simulation-based autonomous cloud optimization platform designed to demonstrate intelligent infrastructure management using AI-driven forecasting and rule-based decision systems. The system models real-world cloud telemetry, predicts workload trends, and dynamically adjusts infrastructure capacity to minimize operational cost while maintaining performance constraints.

This project reflects practical concepts from:
- **FinOps (Cloud Financial Operations)**
- **AIOps (AI for IT Operations)**
- **Autonomous Systems Design**
- **Backend API Engineering**
- **Full-Stack Integration**

---

## 🎯 Objective
Design and implement a closed-loop intelligent system that:
- Continuously monitors simulated cloud workload
- Forecasts future demand using time-series logic
- Automatically scales infrastructure resources
- Calculates cost impact in real-time
- Generates transparent, explainable optimization decisions

---

## 🧩 Problem Statement
Cloud-native applications frequently suffer from over-provisioned infrastructure due to static scaling policies and risk-averse operational practices. This results in:
- Uncontrolled cloud expenditure
- Manual monitoring and delayed optimization
- Lack of intelligent automation

CloudMind AI addresses this gap by introducing a simulated autonomous optimization engine capable of making real-time infrastructure decisions.

---

## 🏗 System Architecture
```
Synthetic Telemetry Generator
		  ↓
Demand Forecasting Module
		  ↓
Autonomous Decision Engine
		  ↓
Cost Optimization Layer
		  ↓
FastAPI Backend
		  ↓
Interactive Dashboard
```

---

## 📂 Repository Structure
```
CloudMind-AI/
│
├── backend/
│   ├── app.py
│   ├── data_generator.py
│   ├── predictor.py
│   ├── decision_engine.py
│
├── frontend/
│   └── dashboard.html
│
├── requirements.txt
└── README.md
```

---

## 🛠 Technology Stack
| Layer              | Technology         |
|--------------------|-------------------|
| Backend API        | FastAPI           |
| Runtime Server     | Uvicorn           |
| Programming Lang   | Python            |
| Frontend           | HTML, JavaScript  |
| Data Simulation    | Python Random     |
| Version Control    | Git & GitHub      |

---

## ⚙️ Installation & Execution
1. **Clone Repository**
	```bash
	git clone https://github.com/mradulg2122-prog/CloudMind-AI.git
	cd CloudMind-AI/backend
	```
2. **Install Dependencies**
	```bash
	pip install -r ../requirements.txt
	```
3. **Start Backend Server**
	```bash
	uvicorn app:app --reload
	```
	Access API documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
4. **Launch Frontend**
	Open `frontend/dashboard.html` in your browser.

---

## 🔄 Core API Endpoint
**GET /optimize**
Executes one autonomous optimization cycle.

**Sample Response:**
```json
{
  "current_load": 610,
  "cpu": 78.4,
  "servers": 4,
  "cost": 200,
  "action": "Scale Up",
  "reason": "Predicted demand increased and CPU exceeded performance threshold."
}
```

---

## ✨ Key Features
- Synthetic cloud telemetry simulation
- Lightweight demand forecasting engine
- Autonomous infrastructure scaling logic
- Cost impact calculation
- Explainable AI-style reasoning output
- RESTful API architecture
- Modular and extensible backend design

---

## 👥 Team Roles
- Cloud Telemetry & Forecasting Engineer
- Autonomous Optimization & Backend Engineer
- Frontend & Dashboard Engineer

---

## 🚀 Future Scope
- Integration with real cloud metrics (AWS/GCP APIs)
- Machine learning-based LSTM forecasting
- Reinforcement learning scaling policies
- Real-time graphical analytics
- Cloud deployment (Render / Railway)
- Authentication & Monitoring layer

---

## 🎓 Academic Context
Developed as a mini-project submission to demonstrate:
- Applied AI system design
- Cloud cost optimization concepts
- Collaborative Git workflow
- End-to-end full-stack architecture

---

## 📜 License
This project is developed strictly for educational and academic purposes.