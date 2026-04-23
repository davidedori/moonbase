export class MissionControl {
  constructor(emitter, uiManager) {
    this.emitter = emitter;
    this.ui = uiManager;
    this.step = 0;
    this._setupListeners();
    setTimeout(() => this.triggerStep0(), 1000);
  }

  _setupListeners() {
    this.emitter.on('resources-updated', (data) => this._checkProgression(data));
  }

  _checkProgression(data) {
    const { energyProduced, deltaReg, deltaComp, deltaO2 } = data;
    if (this.step === 0 && energyProduced > 0) this.triggerStep1();
    if (this.step === 1 && deltaReg > 0) this.triggerStep2();
    if (this.step === 2 && deltaComp > 0) this.triggerStep3();
    if (this.step === 3 && deltaO2 > 0) this.triggerStep4();
  }

  triggerStep0() {
    this.ui.printCommsMessage("> TX_INCOMING: HOUSTON MISSION CONTROL...");
    this.ui.printCommsMessage("> BASE OFFLINE. RESERVES CRITICAL.");
    this.ui.printCommsMessage("> STEP 1: DEPLOY SOLAR ARRAY FOR POWER.");
    this.step = 0;
  }
  triggerStep1() {
    this.step = 1;
    this.ui.printCommsMessage("> POWER GRID ONLINE. VOLTAGE STABLE.");
    this.ui.printCommsMessage("> NEXT: ESTABLISH MINING DISTRICT & REGOLITH EXTRACTOR.");
  }
  triggerStep2() {
    this.step = 2;
    this.ui.printCommsMessage("> REGOLITH INFLOW DETECTED.");
    this.ui.printCommsMessage("> CONSTRUCT COMPONENT FACTORY TO SECURE SUPPLY CHAIN.");
  }
  triggerStep3() {
    this.step = 3;
    this.ui.printCommsMessage("> MANUFACTURING ONLINE. SUPPLY CHAIN SECURED.");
    this.ui.printCommsMessage("> NEXT: EXTRACT ICE AND SYNTHESIZE OXYGEN VIA ISRU.");
  }
  triggerStep4() {
    this.step = 4;
    this.ui.printCommsMessage("> LIFE SUPPORT STABLE. ATMOSPHERE REPLENISHING.");
    this.ui.printCommsMessage("> BASE SELF-SUFFICIENT. MISSION ACCOMPLISHED.");
  }
}
