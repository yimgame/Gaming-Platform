import { getAllMatches, getMatchesByDate, parseMatchXML } from './stats-parser';
import { calculateGlobalRanking, getServerStats } from './stats-service';

async function testStatsSystem() {
  console.log('🔍 Probando el sistema de estadísticas...\n');

  try {
    // Test 1: Leer una partida específica del día 13/02/2026
    console.log('📄 Test 1: Leyendo partida específica...');
    const testMatch = await parseMatchXML('G:\\Games\\Quake3\\cpma\\stats\\2026\\02\\13\\17_13_16.xml');
    console.log(`✅ Partida parseada: ${testMatch.map} - ${testMatch.type}`);
    console.log(`   Equipos: ${testMatch.teams?.length || 0}`);
    console.log(`   Jugadores totales: ${testMatch.teams?.reduce((sum, t) => sum + t.players.length, 0) || 0}\n`);

    // Test 2: Leer todas las partidas del día 13/02/2026
    console.log('📅 Test 2: Leyendo partidas del 13/02/2026...');
    const dayMatches = await getMatchesByDate('2026', '02', '13');
    console.log(`✅ Partidas encontradas: ${dayMatches.length}`);
    dayMatches.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.datetime} - ${m.map} (${m.type})`);
    });
    console.log('');

    // Test 3: Leer todas las partidas disponibles
    console.log('📊 Test 3: Leyendo TODAS las partidas disponibles...');
    const allMatches = await getAllMatches();
    console.log(`✅ Total de partidas en el sistema: ${allMatches.length}`);
    
    if (allMatches.length > 0) {
      const maps = new Set(allMatches.map(m => m.map));
      const types = new Set(allMatches.map(m => m.type));
      console.log(`   Mapas únicos: ${maps.size} (${Array.from(maps).join(', ')})`);
      console.log(`   Tipos de juego: ${types.size} (${Array.from(types).join(', ')})`);
    }
    console.log('');

    // Test 4: Calcular ranking global
    console.log('🏆 Test 4: Calculando ranking global...');
    const ranking = await calculateGlobalRanking();
    console.log(`✅ Ranking generado con ${ranking.length} jugadores`);
    console.log('   Top 5 jugadores:');
    ranking.slice(0, 5).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name.padEnd(20)} - Score: ${p.totalScore.toString().padStart(6)} | K/D: ${p.kdRatio.toFixed(2)} | Partidas: ${p.totalMatches}`);
    });
    console.log('');

    // Test 5: Estadísticas del servidor
    console.log('📈 Test 5: Estadísticas generales del servidor...');
    const serverStats = await getServerStats();
    console.log(`✅ Estadísticas del servidor:`);
    console.log(`   Total de partidas: ${serverStats.totalMatches}`);
    console.log(`   Total de jugadores únicos: ${serverStats.totalPlayers}`);
    console.log(`   Total de kills: ${serverStats.totalKills}`);
    console.log(`   Total de daño: ${serverStats.totalDamage.toLocaleString()}`);
    console.log(`   Mapa más jugado: ${serverStats.maps[0]?.map} (${serverStats.maps[0]?.count} partidas)`);
    console.log('');

    console.log('✨ ¡Todos los tests completados exitosamente!\n');

  } catch (error) {
    console.error('❌ Error en los tests:', error);
    if (error instanceof Error) {
      console.error('   Detalles:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
}

// Ejecutar los tests
testStatsSystem();
