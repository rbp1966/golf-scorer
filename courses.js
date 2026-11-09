var BUILTIN_COURSES = (function(){
  var PARS = [5,4,4,3,4,5,3,4,4, 4,5,3,4,4,3,4,5,4];
  var SI_M = [11,7,15,5,1,9,17,3,13, 4,14,16,12,2,18,10,8,6];
  var SI_W = [3,11,13,15,9,1,17,5,7, 10,6,16,14,12,18,4,2,8];
  var Y = {
    black: [537,393,383,205,418,512,163,401,421, 457,512,176,376,478,135,345,525,421],
    blue:  [523,383,372,192,403,501,143,364,362, 441,487,169,347,445,128,333,514,389],
    bw:    [498,333,372,179,393,501,125,364,340, 353,487,169,347,308,128,333,514,371],
    white: [498,333,360,179,393,487,125,346,340, 353,432,162,337,308,122,323,506,371],
    wg:    [423,333,360,124,275,487,125,346,340, 353,432,162,295,308,122,323,420,312],
    gold:  [423,326,287,124,275,410,119,289,255, 320,422,155,295,304,104,301,420,312]
  };
  function t(id, name, g, rating, slope, y){ return { id:id, name:name, gender:g, rating:rating, slope:slope, par:72, pars:PARS.slice(), si:(g==='F'?SI_W:SI_M).slice(), yards:Y[y].slice() }; }
  return [{
    id: 'yolo-fliers', builtin: true, name: 'Yolo Fliers Club', location: 'Woodland, CA',
    notes: 'Ratings/slopes, pars, stroke indexes and yardages from GolfPass & TheGrint scorecards (cross-checked with Grassy and Desert Nomads). Not verified against USGA NCRDB/GHIN — please confirm in the GHIN app and edit if the club has been re-rated.',
    sources: ['https://www.golfpass.com/travel-advisor/courses/4142-yolo-fliers-club/scorecard-and-layout','https://thegrint.com/golf-courses/us/california/yolo-fliers-club/yolo-fliers-club','https://www.grassy.golf/courses/yolo-fliers-club-us-ca','https://www.desertnomads.org/view_courses.php?course_id=14259'],
    tees: [
      t('black','Black','M',73.0,128,'black'),
      t('blue','Blue','M',71.2,125,'blue'),
      t('bw','Blue/White','M',69.2,121,'bw'),
      t('white','White','M',68.6,120,'white'),
      t('wg','White/Gold','M',66.3,116,'wg'),
      t('gold','Gold','M',64.4,108,'gold'),
      t('blue-w','Blue (W)','F',77.4,133,'blue'),
      t('bw-w','Blue/White (W)','F',75.0,128,'bw'),
      t('white-w','White (W)','F',74.3,127,'white'),
      t('wg-w','White/Gold (W)','F',71.4,122,'wg'),
      t('gold-w','Gold (W)','F',69.0,118,'gold')
    ]
  }];
})();
