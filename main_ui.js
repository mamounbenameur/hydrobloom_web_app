document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('openAddPlantForm').addEventListener('click', () => {
    document.getElementById('addPlantOverlay').classList.add('active');
  });
  document.getElementById('closeAddPlantForm').addEventListener('click', () => {
    document.getElementById('addPlantOverlay').classList.remove('active');
  });

  const btnDefault = document.getElementById('btnDefault');
  const btnCustom  = document.getElementById('btnCustom');
  const cards      = document.querySelectorAll('.sensor-card');

  function setMode(mode) {
    const isDefault = mode === 'default';
    btnDefault.classList.toggle('active',  isDefault);
    btnCustom .classList.toggle('active', !isDefault);
    cards.forEach(card => {
      const inputs = card.querySelectorAll('input');
      const badge  = card.querySelector('.default-badge');
      if (isDefault) {
        card.classList.add('locked');
        badge.style.display = 'inline-flex';
        inputs.forEach(inp => (inp.disabled = true));
      } else {
        card.classList.remove('locked');
        badge.style.display = 'none';
        inputs.forEach(inp => (inp.disabled = false));
      }
    });
  }

  btnDefault.addEventListener('click', () => setMode('default'));
  btnCustom .addEventListener('click', () => setMode('custom'));

  const DEFAULTS = {
    ph:      { min: 5.5,  max: 6.5  },
    tds:     { min: 500,  max: 1000 },
    flow:    { min: 1.0,  max: 3.0  },
    level:   { min: 20,   max: 90   },
    temp:    { min: 18.0, max: 24.0 },
    oxygene: { min: 2.0,  max: 8.0  },  
  };

  function collectSensorData() {
    const isDefault = btnDefault.classList.contains('active');
    const sensors   = {};

    cards.forEach(card => {
      const key    = card.dataset.sensor;
      const inputs = card.querySelectorAll('input');
      const minVal = parseFloat(inputs[0].value);
      const maxVal = parseFloat(inputs[1].value);

      if (isDefault) {
        sensors[key] = { ...DEFAULTS[key] };
      } else {
        if (isNaN(minVal) || isNaN(maxVal)) {
          throw new Error(`Please fill in both Min and Max for the ${key.toUpperCase()} sensor.`);
        }
        if (minVal >= maxVal) {
          throw new Error(`For the ${key.toUpperCase()} sensor, Min must be less than Max.`);
        }
        sensors[key] = { min: minVal, max: maxVal };
      }
    });

    return sensors;
  }

  document.querySelector('.submit-plant-btn').addEventListener('click', () => {
    const plantName = document.getElementById('plantName').value.trim();
    if (!plantName) {
      alert('Please enter a plant name.');
      return;
    }

    let sensors;
    try {
      sensors = collectSensorData();
    } catch (err) {
      alert(err.message);
      return;
    }


    Object.keys(sensors).forEach(key => {
      sensors[key].now = (sensors[key].min + sensors[key].max) / 2;
    });

    const plantData = {
      name:      plantName,
      createdAt: new Date().toISOString(),
      mode:      btnDefault.classList.contains('active') ? 'default' : 'custom',
      sensors,
    };

    localStorage.setItem('hydrobloom_plant', JSON.stringify(plantData));
    window.location.href = 'plant.html';
  });
});
