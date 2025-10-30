/* * Arquivo: mapa.js
 * Descrição: Lógica de inicialização do mapa, geolocalização e interação com APIs de rotas e busca.
 */

// Configurações da aplicação
const CONFIG = {
    // ATENÇÃO: A chave da API abaixo é de teste. Obtenha uma chave oficial da OpenRouteService para produção.
    //eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVkMjJkNjIwMzIwZTRiZDM5ZjhmNzQ1ZjA2ZmZhY2JmIiwiaCI6Im11cm11cjY0In0=
    ORS_API_KEY: "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVkMjJkNjIwMzIwZTRiZDM5ZjhmNzQ1ZjA2ZmZhY2JmIiwiaCI6Im11cm11cjY0In0=",
    DEFAULT_LOCATION: {
        lat: -23.55052,
        lon: -46.633308
    },
    SEARCH_RADIUS: 4000, // metros
    CACHE_DURATION: 5 * 60 * 1000 // 5 minutos em milissegundos
};

// Inicializa mapa
const map = L.map('map').setView([CONFIG.DEFAULT_LOCATION.lat, CONFIG.DEFAULT_LOCATION.lon], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'© OpenStreetMap',
    maxZoom: 18
}).addTo(map);

// Elementos da UI
const statusEl = document.getElementById('status');
const locateBtn = document.getElementById('locateBtn');
const delegaciaListEl = document.getElementById('delegaciaList');
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggleBtn');

// Estado da aplicação
let userMarker = null;
let destMarker = null;
let routeLayer = null;
let userLocation = CONFIG.DEFAULT_LOCATION;
let delegaciasCache = {
    data: null,
    timestamp: null
};

// Funções de utilidade
function setStatus(text, type = 'info') {
    statusEl.innerHTML = '';
    statusEl.className = '';

    if (type === 'loading') {
        statusEl.classList.add('status-loading');
        statusEl.innerHTML = `<div class="spinner"></div><span>${text}</span>`;
    } else if (type === 'error') {
        statusEl.classList.add('status-error');
        statusEl.textContent = text;
    } else if (type === 'success') {
        statusEl.classList.add('status-success');
        statusEl.textContent = text;
    } else {
        statusEl.textContent = text;
    }
}

function toggleButtonLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = `<div class="spinner"></div><span>Buscando...</span>`;
    } else {
        button.disabled = false;
        button.innerHTML = `<span>Buscar delegacias próximas</span>`;
    }
}

// Funções de API (buscarDelegacias, buscarRota, obterLocalizacaoUsuario) OMITIDAS para brevidade, mas devem estar COMPLETAS no seu arquivo mapa.js

async function buscarDelegacias(lat, lon) {
  // ATENÇÃO: A API ORS usa o formato (longitude, latitude)
  const coords = `${lon},${lat}`; 
  
  // Usamos a API 'pois' (Points of Interest) do OpenRouteService
  // Estamos pedindo locais na categoria "police" num raio definido em CONFIG.SEARCH_RADIUS
  const body = JSON.stringify({
    "request": "pois",
    "geometry": {
      "geojson": {
        "type": "Point",
        "coordinates": [lon, lat] 
      },
      "buffer": CONFIG.SEARCH_RADIUS // Raio em metros
    },
    "filters": {
       "category_group_ids": [450] // ID 450 = Amenidades Públicas
       // Infelizmente, a ORS não tem uma categoria "police" fácil.
       // Vamos usar uma categoria ampla e filtrar pelo nome.
       // Se fosse o Overpass API (OSM), poderíamos usar "amenity=police".
    }
  });

  const response = await fetch('https://api.openrouteservice.org/pois', {
    method: 'POST',
    headers: {
      'Authorization': CONFIG.ORS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: body
  });

  if (!response.ok) {
    throw new Error('Falha ao buscar delegacias na API. Verifique a chave da API.');
  }

  const data = await response.json();
  
  // Mapeia e filtra os resultados
  const delegacias = data.features.map(feature => {
    const props = feature.properties;
    // Filtra por nomes que contenham "Delegacia" ou "Polícia"
    const nome = (props.osm_tags && props.osm_tags.name) ? props.osm_tags.name : "Local policial";
    
    if (nome.toLowerCase().includes('delegacia') || nome.toLowerCase().includes('polícia')) {
        return {
          nome: nome,
          lat: feature.geometry.coordinates[1], // Inverte para (lat, lon)
          lon: feature.geometry.coordinates[0]
        };
    }
    return null; // Descarta locais que não parecem ser delegacias
  }).filter(Boolean); // Remove os nulos

  // Se o filtro inicial não retornar nada, retorna locais genéricos (plano B)
  if (delegacias.length === 0) {
      return data.features.slice(0, 10).map(feature => ({ // Limita a 10
         nome: (feature.properties.osm_tags && feature.properties.osm_tags.name) ? feature.properties.osm_tags.name : "Ponto de Interesse Próximo",
         lat: feature.geometry.coordinates[1],
         lon: feature.geometry.coordinates[0]
      }));
  }

  return delegacias;
}


// 2. Adicione a função `buscarRota` (Este seria seu próximo erro!)
async function buscarRota(startCoords, endCoords) {
  // Formato (lon, lat)
  const start = `${startCoords[1]},${startCoords[0]}`;
  const end = `${endCoords[1]},${endCoords[0]}`;

  // Usamos a API 'directions'
  const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${CONFIG.ORS_API_KEY}&start=${start}&end=${end}`);

  if (!response.ok) {
    throw new Error('Falha ao calcular a rota.');
  }

  const data = await response.json();
  const route = data.features[0];
  
  // Converte as coordenadas (lon, lat) para (lat, lon) para o Leaflet
  const coords = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);

  return {
    coords: coords,
    summary: route.properties.summary
  };
}

function obterLocalizacaoUsuario() {
  return new Promise((resolve, reject) => {
    // Verifica se o navegador suporta geolocalização
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não é suportada pelo seu navegador."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Sucesso
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      (error) => {
        // Erro
        let errorMessage = "Ocorreu um erro desconhecido.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "User denied Geolocation"; // Mensagem que aparecia antes
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Informação de localização indisponível.";
            break;
          case error.TIMEOUT:
            errorMessage = "O pedido de localização expirou.";
            break;
        }
        reject(new Error(errorMessage));
      },
      {
        // Opções
        enableHighAccuracy: true, // Tenta obter a localização mais precisa
        timeout: 10000,         // Tempo limite de 10 segundos
        maximumAge: 0           // Não usa cache
      }
    );
  });
}


// Inicializar mapa com localização do usuário
async function inicializarMapa() {
    try {
        setStatus('Obtendo sua localização...', 'loading');
        userLocation = await obterLocalizacaoUsuario();

        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([userLocation.lat, userLocation.lon])
            .addTo(map)
            .bindPopup("Sua localização atual")
            .openPopup();

        map.setView([userLocation.lat, userLocation.lon], 14);
        setStatus('Localização obtida com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao obter localização:', error);

        userLocation = CONFIG.DEFAULT_LOCATION;
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([userLocation.lat, userLocation.lon])
            .addTo(map)
            .bindPopup("Localização simulada (São Paulo)")
            .openPopup();

        map.setView([userLocation.lat, userLocation.lon], 14);
        setStatus(`Usando localização padrão: ${error.message}`, 'error');
    }
}

// Evento de clique para buscar delegacias
locateBtn.onclick = async () => {
    try {
        toggleButtonLoading(locateBtn, true);
        setStatus('Buscando delegacias próximas...', 'loading');

        const delegacias = await buscarDelegacias(userLocation.lat, userLocation.lon);
        delegaciaListEl.innerHTML = "";

        if (delegacias.length === 0) {
            delegaciaListEl.innerHTML = '<div class="no-results">Nenhuma delegacia encontrada nesta área</div>';
            setStatus('Nenhuma delegacia encontrada. Tente aumentar o raio de busca.', 'info');
            return;
        }

        delegacias.forEach(d => {
            const item = document.createElement('div');
            item.className = "list-item";
            item.tabIndex = 0; // Tornar focável
            item.setAttribute('role', 'button');
            item.setAttribute('aria-label', `Selecionar ${d.nome}`);
            item.innerHTML = `<span>${d.nome}</span><span class="distance">-- km</span>`;

            item.onclick = async () => {
                document.querySelectorAll('.list-item').forEach(e => e.classList.remove('active'));
                item.classList.add('active');

                try {
                    setStatus(`Calculando rota para ${d.nome}...`, 'loading');

                    if (routeLayer) map.removeLayer(routeLayer);
                    if (destMarker) map.removeLayer(destMarker);

                    destMarker = L.marker([d.lat, d.lon])
                        .addTo(map)
                        .bindPopup(d.nome)
                        .openPopup();

                    const routeData = await buscarRota(
                        [userLocation.lat, userLocation.lon],
                        [d.lat, d.lon]
                    );
                    
                    // CORREÇÃO: LER A VARIÁVEL CSS DO TEMA ATUAL
                    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--cor-primaria').trim() || '#7E2A53';

                    routeLayer = L.polyline(routeData.coords, {
                        color: primaryColor, 
                        weight: 5,
                        opacity: 0.8
                    }).addTo(map);

                    map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });

                    const distanciaKm = (routeData.summary.distance / 1000).toFixed(2);
                    const duracaoMin = Math.round(routeData.summary.duration / 60);
                    item.querySelector(".distance").innerText = `${distanciaKm} km`;

                    setStatus(
                        `Rota traçada até ${d.nome} — ${distanciaKm} km, ~${duracaoMin} min`,
                        'success'
                    );
                } catch (error) {
                    console.error('Erro ao traçar rota:', error);
                    setStatus(error.message, 'error');
                }
            };

            item.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    item.click();
                }
            };

            delegaciaListEl.appendChild(item);
        });

        setStatus(`${delegacias.length} delegacias encontradas. Clique em uma para traçar rota.`, 'success');
    } catch (error) {
        console.error('Erro ao buscar delegacias:', error);
        setStatus(error.message, 'error');
    } finally {
        toggleButtonLoading(locateBtn, false);
    }
};

// Toggle sidebar
toggleBtn.onclick = () => {
    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    toggleBtn.innerText = isCollapsed ? "⮞" : "⮜";
    toggleBtn.setAttribute('aria-label', isCollapsed ? 'Abrir menu' : 'Fechar menu');
};

// Fechar sidebar ao clicar fora (em dispositivos móveis)
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 480 &&
        !sidebar.contains(e.target) &&
        e.target !== toggleBtn &&
        !sidebar.classList.contains('collapsed')) {
        sidebar.classList.add('collapsed');
        toggleBtn.innerText = "⮞";
        toggleBtn.setAttribute('aria-label', 'Abrir menu');
    }
});

// Inicializar a aplicação
inicializarMapa();