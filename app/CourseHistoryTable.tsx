"use client";

import { Fragment, useMemo, useState } from "react";

type PlayerRow = {
  name: string;
  app: number;
  made: number;
  avg: number;
  best: number | null;
  rounds: number;
  sgAvg: number;
};

// Manually transcribed from a "Rabbit Hole"/BetspertsGolf strokes-gained
// screenshot covering every TPC Twin Cities / 3M Open appearance,
// 2019-2025. "100" on the source sheet means a missed cut - reshaped here
// around make-cut rate and finish average since that's what actually
// drives Top N / Make Cut parlay building, with strokes gained kept as a
// secondary sort rather than the focus.
const COURSE_HISTORY: Record<string, [string, number, number, number, number | null, number, number][]> = {
  "Rocket Classic": [
    // [name, apps, made, avgFinish, bestFinish, rounds, sgAvg]
    // Data from Betsperts/Ron Klos. 100=MC. Note: 2026 is par 70 redesign.
    // Page 1
    ["Chris Kirk", 6, 6, 18.3, 2, 24, 1.78],
    ["J.J. Spaun", 6, 6, 21.0, 8, 24, 1.52],
    ["Taylor Moore", 4, 3, 30.0, 4, 14, 2.29],
    ["Cam Davis", 7, 4, 47.6, 1, 22, 1.37],
    ["Cameron Young", 3, 3, 18.0, 2, 12, 2.06],
    ["Rickie Fowler", 7, 5, 46.0, 1, 24, 0.89],
    ["Sungjae Im", 4, 4, 26.5, 8, 16, 1.28],
    ["Davis Thompson", 4, 4, 29.5, 2, 16, 1.25],
    ["Keegan Bradley", 5, 5, 33.0, 14, 20, 0.97],
    ["Lucas Glover", 4, 3, 41.5, 4, 14, 1.34],
    ["Hideki Matsuyama", 2, 1, 56.5, 13, 15, 1.25],
    ["Taylor Pendrith", 3, 3, 29.3, 2, 12, 1.53],
    ["Patrick Cantlay", 2, 2, 17.0, 2, 8, 2.29],
    ["Tony Finau", 3, 2, 51.3, 1, 10, 1.69],
    ["Adam Schenk", 7, 4, 60.0, 7, 22, 0.76],
    ["Max Greyserman", 2, 2, 16.5, 2, 8, 2.01],
    ["Ben Griffin", 3, 3, 25.7, 13, 12, 1.29],
    ["Akshay Bhatia", 3, 2, 42.7, 2, 10, 1.52],
    ["Jake Knapp", 2, 2, 17.5, 4, 8, 1.89],
    ["Mark Hubbard", 6, 3, 62.8, 12, 18, 0.82],
    ["Wyndham Clark", 3, 2, 41.7, 8, 10, 1.47],
    ["Jason Day", 3, 2, 43.7, 14, 10, 1.33],
    ["Stephan Jaeger", 5, 2, 62.8, 5, 14, 0.93],
    ["Maverick McNealy", 4, 3, 43.3, 21, 14, 0.91],
    ["Dylan Wu", 3, 2, 44.7, 10, 10, 1.25],
    ["Nicolai Hojgaard", 3, 3, 37.0, 21, 12, 0.96],
    ["Jackson Suber", 1, 1, 6.0, 6, 4, 2.68],
    ["Chad Ramey", 4, 2, 60.8, 17, 12, 0.81],
    // Page 2
    ["Eric Cole", 1, 1, 6.0, 6, 4, 2.34],
    ["Jacob Bridgeman", 2, 2, 28.5, 26, 8, 1.14],
    ["Kevin Roy", 2, 1, 54.0, 8, 6, 1.48],
    ["Matt Wallace", 5, 4, 49.2, 10, 18, 0.49],
    ["Harry Hall", 3, 2, 48.0, 13, 10, 0.82],
    ["Nico Echavarria", 3, 2, 56.3, 6, 10, 0.82],
    ["Luke Clanton", 2, 2, 35.0, 10, 8, 1.01],
    ["Vince Whaley", 6, 5, 50.7, 17, 22, 0.36],
    ["Matt McCarty", 1, 1, 19.0, 19, 4, 1.93],
    ["Zecheng Dou", 1, 1, 17.0, 17, 4, 1.85],
    ["Aldrich Potgieter", 2, 1, 50.5, 1, 6, 1.14],
    ["Billy Horschel", 1, 1, 17.0, 17, 4, 1.59],
    ["Michael Thorbjornsen", 3, 1, 68.0, 4, 8, 0.80],
    ["Patrick Rodgers", 5, 4, 52.2, 31, 18, 0.35],
    ["Russell Henley", 2, 1, 55.0, 10, 6, 0.99],
    ["Mackenzie Hughes", 3, 2, 45.0, 14, 10, 0.57],
    ["Kristoffer Ventura", 3, 2, 51.7, 21, 10, 0.56],
    ["Neal Shipley", 1, 1, 20.0, 20, 4, 1.34],
    ["Rico Hoey", 2, 1, 53.0, 6, 6, 0.85],
    ["Sam Stevens", 2, 2, 42.0, 10, 8, 0.60],
    ["Kevin Streelman", 3, 3, 47.0, 49, 12, 0.36],
    ["Joe Highsmith", 2, 2, 45.5, 34, 8, 0.51],
    ["Patrick Fishburn", 2, 1, 62.5, 25, 6, 0.68],
    ["William Mouw", 1, 1, 34.0, 34, 4, 0.93],
    ["Chris Gotterup", 3, 3, 47.3, 26, 12, 0.31],
    ["Nick Taylor", 3, 2, 62.3, 52, 10, 0.37],
    ["Doug Ghim", 6, 3, 64.0, 19, 18, 0.19],
    ["Lee Hodges", 4, 2, 69.5, 34, 12, 0.28],
    // Page 3
    ["Aaron Wise", 3, 2, 62.0, 35, 10, 0.33],
    ["Ryo Hisatsune", 2, 2, 45.5, 31, 8, 0.39],
    ["Adam Svensson", 5, 2, 72.8, 24, 14, 0.21],
    ["Denny McCarthy", 3, 1, 73.7, 21, 8, 0.36],
    ["Andrew Putnam", 3, 1, 69.3, 8, 8, 0.33],
    ["Ben James", 1, 1, 44.0, 44, 4, 0.59],
    ["Hank Lebioda", 5, 2, 73.6, 4, 14, 0.16],
    ["Ryan Gerard", 2, 2, 48.5, 41, 8, 0.27],
    ["Nick Dunlap", 2, 1, 55.0, 10, 6, 0.35],
    ["Takumi Kanaya", 1, 1, 46.0, 46, 4, 0.43],
    ["Chandler Phillips", 3, 2, 60.0, 13, 10, 0.13],
    ["Webb Simpson", 6, 3, 71.3, 51, 18, 0.07],
    ["Brandt Snedeker", 6, 2, 73.8, 38, 16, 0.05],
    ["Matti Schmid", 2, 1, 76.0, 52, 6, 0.08],
    ["Peter Malnati", 7, 5, 60.9, 9, 24, 0.02],
    ["Davis Riley", 4, 3, 64.3, 33, 14, 0.02],
    ["Harris English", 2, 1, 77.5, 55, 6, 0.02],
    ["Brice Garnett", 6, 2, 77.3, 17, 16, -0.01],
    ["Rasmus Hojgaard", 1, 0, 100.0, null, 2, -0.14],
    ["Seamus Power", 4, 2, 55.0, 8, 12, -0.02],
    ["Kevin Yu", 2, 1, 65.5, 31, 6, -0.09],
    ["Pierceson Coody", 1, 1, 63.0, 63, 4, -0.16],
    ["Jesper Svensson", 1, 0, 100.0, null, 2, -0.64],
    ["Mac Meissner", 2, 0, 100.0, null, 4, -0.35],
    ["Emiliano Grillo", 3, 2, 70.7, 39, 10, -0.14],
    ["Erik van Rooyen", 4, 2, 71.0, 6, 12, -0.13],
    ["Corey Conners", 1, 0, 100.0, null, 2, -0.84],
    // Page 4
    ["Steven Fisk", 1, 0, 100.0, null, 2, -1.14],
    ["Christiaan Bezuidenhout", 2, 1, 78.0, 56, 6, -0.40],
    ["Garrick Higgo", 5, 2, 74.8, 33, 14, -0.19],
    ["Brendon Todd", 4, 2, 78.3, 56, 12, -0.23],
    ["Jackson Koivun", 1, 0, 100.0, null, 2, -1.55],
    ["Beau Hossler", 7, 4, 69.3, 25, 22, -0.14],
    ["Austin Smotherman", 2, 1, 84.5, 69, 6, -0.54],
    ["Thorbjorn Olesen", 2, 1, 70.5, 41, 6, -0.56],
    ["Trace Crowe", 1, 0, 100.0, null, 2, -2.05],
    ["Gordon Sargent", 2, 1, 83.5, 67, 6, -0.69],
    ["Danny Walker", 1, 0, 100.0, null, 2, -2.14],
    ["Ricky Castillo", 1, 0, 100.0, null, 2, -2.14],
    ["Si Woo Kim", 5, 4, 62.6, 14, 18, -0.26],
    ["Adrien Dumont de Chassart", 1, 0, 100.0, null, 2, -2.55],
    ["Joel Dahmen", 5, 2, 69.2, 21, 14, -0.39],
    ["David Lipsky", 3, 1, 79.0, 37, 9, -0.63],
    ["Andrew Novak", 3, 1, 73.3, 20, 8, -0.72],
    ["Karl Vilips", 1, 0, 100.0, null, 2, -3.14],
    ["Alejandro Tosti", 1, 0, 100.0, null, 3, -2.13],
    ["Max McGreevy", 3, 0, 100.0, null, 6, -1.24],
    ["Patton Kizzire", 7, 3, 74.1, 20, 20, -0.41],
    ["Austin Eckroat", 3, 1, 86.7, 60, 8, -1.05],
    ["Zach Bauchou", 1, 0, 100.0, null, 2, -5.84],
    ["Keith Mitchell", 3, 0, 100.0, null, 6, -2.01],
    ["Michael Kim", 5, 2, 75.6, 26, 14, -0.98],
    ["Tom Hoge", 4, 1, 91.0, 64, 10, -1.76],
    ["Rafael Campos", 3, 0, 100.0, null, 6, -2.94],
  ],
  "3M Open": [
    ["Tony Finau", 7, 6, 24.9, 1, 26, 1.84],
    ["Emiliano Grillo", 6, 5, 26.5, 2, 22, 1.87],
    ["Cam Davis", 7, 5, 40.7, 10, 24, 1.27],
    ["Brice Garnett", 7, 7, 34.1, 16, 28, 0.99],
    ["Doug Ghim", 6, 4, 47.5, 16, 20, 1.26],
    ["Adam Hadwin", 6, 4, 48.7, 4, 20, 1.21],
    ["Kurt Kitayama", 2, 2, 3.5, 1, 8, 2.99],
    ["Cameron Champ", 5, 4, 31.4, 1, 18, 1.26],
    ["Sam Stevens", 3, 3, 25.3, 2, 12, 1.71],
    ["Adam Svensson", 5, 4, 40.6, 14, 18, 1.03],
    ["Lee Hodges", 4, 2, 54.3, 1, 12, 1.54],
    ["Hank Lebioda", 4, 3, 44.0, 16, 16, 1.08],
    ["Keith Mitchell", 6, 4, 53.7, 5, 20, 0.87],
    ["Sungjae Im", 4, 2, 54.3, 2, 12, 1.35],
    ["Maverick McNealy", 4, 3, 42.0, 3, 14, 1.15],
    ["Kevin Streelman", 3, 3, 33.3, 2, 12, 1.29],
    ["Taylor Moore", 2, 2, 13.0, 12, 8, 1.87],
    ["Matt Kuchar", 3, 2, 48.7, 3, 10, 1.45],
    ["Patrick Rodgers", 5, 4, 49.0, 32, 18, 0.80],
    ["Matti Schmid", 3, 3, 31.0, 12, 12, 1.13],
    ["Nick Hardy", 4, 4, 36.3, 13, 16, 0.81],
    ["Gary Woodland", 4, 3, 42.0, 11, 14, 0.87],
    ["Brian Harman", 2, 2, 24.0, 7, 8, 1.53],
    ["Max Greyserman", 2, 1, 51.0, 2, 6, 1.99],
    ["Patrick Fishburn", 2, 2, 25.0, 6, 8, 1.49],
    ["Max Homa", 3, 3, 40.3, 3, 11, 1.07],
    ["David Lipsky", 3, 2, 48.7, 3, 10, 1.10],
    ["Ben Kohles", 3, 2, 48.0, 20, 10, 0.83],
    ["Chad Ramey", 3, 3, 35.0, 24, 12, 0.88],
    ["Mackenzie Hughes", 4, 4, 42.0, 19, 16, 0.66],
    ["Takumi Kanaya", 1, 1, 7.0, 7, 4, 2.50],
    ["William Mouw", 1, 1, 7.0, 7, 4, 2.50],
    ["Taylor Pendrith", 3, 2, 57.7, 5, 10, 0.96],
    ["Tom Kim", 1, 1, 27.0, 28, 8, 1.19],
    ["Hideki Matsuyama", 2, 2, 18.5, 7, 9, 1.04],
    ["Troy Merritt", 7, 4, 62.7, 7, 22, 0.42],
    ["Zac Blair", 3, 2, 52.3, 13, 10, 0.90],
    ["Tom Hoge", 7, 4, 56.1, 4, 22, 0.40],
    ["Chris Kirk", 3, 2, 51.7, 14, 10, 0.82],
    ["Denny McCarthy", 3, 3, 40.7, 23, 12, 0.65],
    ["Billy Horschel", 1, 1, 13.0, 13, 4, 1.90],
    ["Jesper Svensson", 1, 1, 14.0, 14, 4, 1.75],
    ["Thorbjorn Olesen", 1, 1, 14.0, 14, 4, 1.75],
    ["Mac Meissner", 2, 2, 36.5, 14, 8, 0.87],
    ["Tyler Duncan", 5, 4, 60.2, 20, 17, 0.39],
    ["David Skinns", 3, 3, 45.0, 24, 12, 0.53],
    ["Pierceson Coody", 2, 2, 37.5, 3, 8, 0.74],
    ["Trace Crowe", 1, 1, 24.0, 24, 4, 1.48],
    ["Christiaan Bezuidenhout", 2, 1, 60.0, 20, 6, 0.95],
    ["Austin Eckroat", 4, 2, 63.8, 16, 12, 0.39],
    ["Brandt Snedeker", 4, 2, 66.0, 11, 12, 0.39],
    ["Andrew Putnam", 5, 2, 66.0, 11, 14, 0.33],
    ["Mark Hubbard", 3, 2, 59.0, 16, 10, 0.43],
    ["Neal Shipley", 1, 1, 37.0, 37, 4, 0.98],
    ["Fabian Gomez", 3, 1, 71.0, 13, 8, 0.39],
    ["Seamus Power", 2, 2, 32.5, 28, 10, 0.31],
    ["Garrick Higgo", 4, 3, 63.0, 13, 12, 0.26],
    ["Corey Conners", 1, 1, 46.0, 46, 4, 0.75],
    ["Beau Hossler", 7, 3, 70.9, 13, 20, 0.14],
    ["Dylan Wu", 4, 2, 52.7, 5, 12, 0.22],
    ["Jake Knapp", 1, 1, 3.0, 3, 7, 0.30],
    ["Davis Riley", 3, 1, 82.0, 46, 8, 0.25],
    ["Matthieu Pavon", 1, 1, 44.0, 44, 4, 0.50],
    ["Kevin Roy", 2, 1, 64.0, 28, 6, 0.28],
    ["Camilo Villegas", 3, 3, 54.0, 51, 12, 0.09],
    ["Joe Highsmith", 2, 1, 72.0, 44, 6, 0.16],
    ["Patton Kizzire", 7, 4, 65.3, 34, 22, 0.02],
    ["Aaron Wise", 1, 0, 100.0, null, 2, 0.08],
    ["Haotong Li", 1, 0, 100.0, null, 2, 0.01],
    ["Paul Peterson", 1, 0, 100.0, null, 2, 0.01],
    ["Preston Stout", 1, 0, 100.0, null, 2, 0.01],
    ["Ricky Castillo", 1, 0, 100.0, null, 2, 0.01],
    ["Lucas Glover", 4, 1, 76.8, 7, 10, -0.01],
    ["Justin Lower", 4, 2, 69.0, 33, 12, -0.03],
    ["Jeremy Paul", 1, 0, 100.0, null, 2, -0.49],
    ["Luke List", 5, 2, 78.0, 32, 14, -0.07],
    ["Hayden Springer", 2, 1, 79.5, 59, 6, -0.18],
    ["Stephan Jaeger", 3, 2, 65.3, 30, 10, -0.14],
    ["Jackson Suber", 1, 0, 100.0, null, 2, -0.99],
    ["Rico Hoey", 2, 2, 62.0, 57, 8, -0.26],
    ["Davis Thompson", 1, 0, 100.0, null, 4, -0.43],
    ["Luke Clanton", 2, 1, 80.5, 61, 6, -0.43],
    ["Adrien Dumont de Chassart", 1, 0, 100.0, null, 2, -1.29],
    ["Danny Walker", 1, 0, 100.0, null, 2, -1.49],
    ["Karl Vilips", 1, 0, 100.0, null, 2, -1.49],
    ["Joel Dahmen", 4, 2, 76.5, 39, 12, -0.27],
    ["Peter Malnati", 7, 2, 79.6, 11, 18, -0.18],
    ["Kevin Yu", 3, 2, 70.0, 37, 10, -0.35],
    ["Jason Day", 2, 2, 65.0, 64, 8, -0.44],
    ["Austin Smotherman", 3, 2, 59.0, 24, 10, -0.39],
    ["Max McGreevy", 3, 1, 76.7, 30, 8, -0.54],
    ["Ben James", 1, 0, 100.0, null, 2, -2.29],
    ["Gordon Sargent", 1, 0, 100.0, null, 2, -2.49],
    ["Steven Fisk", 1, 1, 74.0, 74, 4, -1.25],
    ["Zecheng Dou", 1, 0, 100.0, null, 2, -2.67],
    ["Lanto Griffin", 4, 1, 86.0, 44, 10, -0.54],
    ["Chandler Phillips", 2, 0, 100.0, null, 4, -1.64],
    ["Kris Ventura", 2, 0, 100.0, null, 6, -1.14],
    ["Adam Schenk", 6, 4, 67.5, 41, 20, 0.02],
    ["S.Y. Noh", 2, 2, 53.5, 38, 10, -0.71],
    ["Ryan Fox", 1, 0, 100.0, null, 2, -3.67],
    ["Vince Whaley", 3, 1, 85.7, 57, 8, -0.98],
    ["Nicholas Lindheim", 1, 0, 100.0, null, 3, -2.76],
    ["Michael Kim", 4, 1, 87.8, 39, 12, -0.70],
    ["Harry Higgs", 5, 1, 85.0, 25, 12, -0.76],
    ["Ben Silverman", 3, 2, 71.3, 53, 10, -0.93],
    ["Nick Dunlap", 2, 0, 100.0, null, 4, -2.64],
    ["Ben Martin", 4, 0, 100.0, null, 10, -1.11],
    ["Thomas Campbell", 1, 0, 100.0, null, 2, -5.99],
    ["Alejandro Tosti", 1, 0, 100.0, null, 2, -6.79],
    ["Erik van Rooyen", 5, 1, 91.6, 58, 12, -1.18],
    ["Ryan Brehm", 6, 2, 80.3, 31, 16, -0.92],
    ["Rafael Campos", 3, 0, 100.0, null, 6, -3.10],
    ["Will Gordon", 3, 0, 100.0, null, 10, -2.98],
  ],
  "Wyndham Championship": [
    ["Webb Simpson", 9, 8, 24.6, 2, 35, 2.02],
    ["Billy Horschel", 8, 8, 15.3, 2, 32, 2.07],
    ["Sungjae Im", 7, 7, 17.6, 2, 28, 1.84],
    ["Denny McCarthy", 8, 6, 40.8, 9, 28, 1.31],
    ["J.T. Poston", 9, 5, 54.4, 1, 28, 1.08],
    ["Mark Hubbard", 8, 5, 56.8, 3, 26, 1.06],
    ["Cameron Young", 2, 2, 11.5, 1, 8, 3.14],
    ["Ben Griffin", 4, 3, 30.5, 4, 14, 1.69],
    ["Aaron Rai", 4, 3, 44.3, 1, 14, 1.62],
    ["Chris Kirk", 6, 5, 40.3, 5, 22, 1.0],
    ["Cam Davis", 5, 4, 37.6, 7, 18, 1.15],
    ["Harris English", 7, 6, 43.1, 11, 26, 0.78],
    ["Brandt Snedeker", 8, 5, 53.8, 1, 26, 0.78],
    ["Mac Meissner", 2, 2, 7.0, 2, 8, 2.51],
    ["Davis Thompson", 4, 3, 36.3, 11, 14, 1.33],
    ["Hideki Matsuyama", 6, 3, 55.5, 3, 18, 1.03],
    ["Lucas Glover", 9, 5, 64.2, 1, 28, 0.63],
    ["Bud Cauley", 6, 4, 48.2, 10, 20, 0.87],
    ["Adam Svensson", 5, 4, 44.6, 7, 18, 0.96],
    ["Brice Garnett", 9, 5, 59.8, 6, 28, 0.57],
    ["Matt Kuchar", 4, 4, 30.8, 12, 16, 0.99],
    ["Patrick Rodgers", 8, 6, 56.9, 15, 27, 0.55],
    ["Taylor Moore", 4, 3, 44.8, 5, 14, 1.05],
    ["Alex Noren", 3, 3, 33.7, 3, 12, 1.19],
    ["Max McGreevy", 3, 3, 30.0, 5, 12, 1.09],
    ["Tom Kim", 2, 1, 1.0, 1, 5, 2.37],
    ["Max Greyserman", 2, 1, 51.0, 2, 6, 1.96],
    ["Nick Taylor", 7, 4, 64.1, 8, 22, 0.53],
    ["Nico Echavarria", 3, 2, 47.0, 19, 10, 1.13],
    ["Brian Harman", 5, 4, 49.8, 6, 20, 0.56],
    ["Jackson Koivun", 1, 1, 5.0, 5, 4, 2.8],
    ["Patrick Fishburn", 2, 1, 54.0, 8, 6, 1.83],
    ["Matt McCarty", 1, 1, 8.0, 8, 4, 2.55],
    ["Matt Wallace", 5, 3, 60.0, 27, 16, 0.63],
    ["Peter Malnati", 10, 6, 62.5, 20, 32, 0.3],
    ["Christiaan Bezuidenhout", 5, 5, 43.8, 22, 20, 0.48],
    ["Alex Smalley", 5, 2, 68.4, 13, 14, 0.68],
    ["Aaron Wise", 5, 3, 51.8, 13, 15, 0.58],
    ["C.T. Pan", 5, 5, 45.4, 2, 24, 0.35],
    ["Keegan Bradley", 4, 3, 52.5, 22, 14, 0.59],
    ["Keith Mitchell", 6, 4, 60.3, 12, 20, 0.4],
    ["Trace Crowe", 1, 1, 7.0, 7, 4, 1.98],
    ["Andrew Putnam", 5, 2, 70.8, 27, 14, 0.55],
    ["Eric Cole", 3, 3, 31.7, 7, 12, 0.64],
    ["Doug Ghim", 6, 2, 73.1, 20, 20, 0.37],
    ["Patton Kizzire", 9, 5, 65.0, 13, 28, 0.26],
    ["Karl Vilips", 1, 1, 19.0, 19, 4, 1.8],
    ["Luke Clanton", 2, 2, 36.0, 5, 8, 0.89],
    ["Austin Eckroat", 4, 2, 60.8, 6, 12, 0.52],
    ["Ricky Castillo", 1, 1, 23.0, 23, 4, 1.55],
    ["Chandler Phillips", 2, 2, 36.0, 34, 8, 0.76],
    ["Matti Schmid", 3, 3, 39.0, 22, 12, 0.47],
    ["Justin Thomas", 2, 1, 56.0, 12, 6, 0.88],
    ["David Lipsky", 4, 3, 54.0, 27, 14, 0.35],
    ["Lanto Griffin", 3, 2, 60.0, 23, 10, 0.48],
    ["Davis Riley", 4, 2, 62.8, 13, 12, 0.36],
    ["Rasmus Hojgaard", 1, 1, 34.0, 34, 4, 0.8],
    ["Rico Hoey", 2, 2, 44.5, 22, 8, 0.39],
    ["Beau Hossler", 6, 3, 65.3, 12, 18, 0.17],
    ["Austin Smotherman", 3, 1, 63.5, 28, 6, 0.49],
    ["Mackenzie Hughes", 6, 4, 58.8, 22, 20, 0.15],
    ["Stephan Jaeger", 6, 3, 66.2, 13, 18, 0.15],
    ["Justin Lower", 4, 3, 53.3, 33, 14, 0.19],
    ["William Mouw", 1, 1, 38.0, 38, 4, 0.55],
    ["Ben Kohles", 3, 1, 84.7, 54, 8, 0.26],
    ["Ryo Hisatsune", 2, 1, 51.5, 3, 6, 0.3],
    ["Tony Finau", 1, 1, 44.0, 44, 4, 0.3],
    ["Zecheng Dou", 2, 1, 75.5, 51, 6, 0.16],
    ["Daniel Berger", 3, 2, 61.3, 39, 10, 0.09],
    ["Takumi Kanaya", 1, 0, 100.0, null, 2, -0.07],
    ["Seamus Power", 7, 6, 57.4, 27, 25, -0.01],
    ["Kristoffer Ventura", 3, 1, 79.0, 37, 8, -0.06],
    ["Brian Campbell", 2, 0, 100.0, null, 4, -0.16],
    ["Steven Fisk", 1, 1, 60.0, 60, 4, -0.21],
    ["Adrien Dumont de Chassart", 1, 0, 100.0, null, 2, -0.59],
    ["Taylor Pendrith", 2, 1, 56.5, 13, 6, -0.23],
    ["Kevin Streelman", 6, 2, 79.8, 7, 16, -0.1],
    ["Lee Hodges", 3, 2, 67.3, 47, 10, -0.16],
    ["Andrew Novak", 4, 2, 71.3, 33, 12, -0.19],
    ["Jordan Spieth", 4, 3, 70.3, 31, 13, -0.19],
    ["Haotong Li", 1, 0, 100.0, null, 2, -1.26],
    ["Harry Hall", 3, 1, 71.7, 15, 8, -0.35],
    ["Kevin Roy", 2, 0, 100.0, null, 4, -0.73],
    ["Ryan Gerard", 2, 0, 100.0, null, 4, -0.73],
    ["Thorbjorn Olesen", 2, 1, 81.0, 62, 6, -0.5],
    ["Joel Dahmen", 7, 6, 59.9, 15, 26, -0.12],
    ["Danny Walker", 1, 0, 100.0, null, 2, -1.57],
    ["Gordon Sargent", 1, 0, 100.0, null, 2, -1.57],
    ["Emiliano Grillo", 3, 2, 67.7, 44, 10, -0.34],
    ["Brooks Koepka", 1, 0, 100.0, null, 2, -1.99],
    ["Jesper Svensson", 1, 0, 100.0, null, 2, -2.07],
    ["Joe Highsmith", 2, 0, 100.0, null, 4, -1.08],
    ["Nick Dunlap", 2, 0, 100.0, null, 4, -1.08],
    ["Matthieu Pavon", 1, 1, 72.0, 72, 4, -1.21],
    ["Maverick McNealy", 2, 1, 72.5, 45, 6, -0.85],
    ["Jackson Suber", 1, 0, 100.0, null, 2, -2.57],
    ["Alejandro Tosti", 1, 0, 100.0, null, 2, -2.59],
    ["Tom Hoge", 6, 3, 70.7, 20, 17, -0.33],
    ["Sepp Straka", 4, 2, 63.5, 15, 12, -0.48],
    ["Erik van Rooyen", 4, 1, 79.0, 37, 9, -0.7],
    ["Hank Lebioda", 5, 2, 84.0, 42, 13, -0.53],
    ["Chad Ramey", 4, 1, 88.0, 52, 10, -0.77],
    ["Sahith Theegala", 1, 0, 100.0, null, 2, -4.07],
    ["Pierceson Coody", 2, 1, 80.5, 61, 6, -1.37],
    ["Rafael Campos", 3, 1, 91.3, 74, 8, -1.26],
    ["Zac Blair", 6, 2, 87.5, 45, 15, -0.73],
    ["Sam Stevens", 3, 0, 100.0, null, 6, -1.85],
    ["Garrick Higgo", 4, 0, 100.0, null, 8, -1.47],
    ["Kevin Yu", 3, 0, 100.0, null, 6, -2.02],
    ["Vince Whaley", 5, 3, 74.8, 37, 16, -1.06],
    ["Dylan Wu", 3, 1, 83.7, 51, 8, -2.16],
    ["Adam Schenk", 8, 2, 89.4, 51, 20, -1.3],
    ["Michael Kim", 7, 5, 67.3, 5, 27, -1.17],
  ],
  "FedEx St. Jude Championship": [
    ["Ludvig Aberg", 2, 2, 24.5, 9, 8, 0.53],
    ["Tom Kim", 3, 3, 29.0, 13, 12, 0.35],
    ["Ben Griffin", 3, 3, 27.7, 9, 12, 0.32],
    ["Jacob Bridgeman", 1, 1, 17.0, 17, 4, 0.88],
    ["Eric Cole", 2, 2, 24.5, 18, 8, 0.42],
    ["Sepp Straka", 4, 4, 35.8, 2, 16, 0.17],
    ["Harry Hall", 1, 1, 22.0, 22, 4, 0.63],
    ["Bud Cauley", 1, 1, 14.0, 14, 6, 0.28],
    ["Kurt Kitayama", 3, 2, 53.7, 9, 10, 0.1],
    ["Rickie Fowler", 5, 4, 48.6, 6, 18, 0.02],
    ["Alex Noren", 2, 2, 21.0, 12, 9, 0.04],
    ["Matti Schmid", 1, 1, 38.0, 38, 4, -0.13],
    ["Nico Echavarria", 1, 1, 38.0, 38, 4, -0.13],
    ["Corey Conners", 8, 8, 36.9, 6, 32, -0.03],
    ["Ryan Gerard", 1, 1, 44.0, 44, 4, -0.38],
    ["Jordan Spieth", 7, 6, 38.0, 6, 26, -0.07],
    ["Wyndham Clark", 4, 4, 39.3, 7, 16, -0.21],
    ["Ryan Fox", 1, 1, 50.0, 50, 4, -0.88],
    ["Nick Taylor", 6, 5, 49.7, 24, 22, -0.19],
    ["Chris Gotterup", 1, 1, 54.0, 54, 4, -1.13],
    ["Sam Stevens", 2, 2, 45.5, 37, 8, -0.62],
    ["Aldrich Potgieter", 1, 1, 59.0, 59, 4, -1.63],
    ["Patrick Rodgers", 4, 3, 55.8, 33, 16, -0.56],
    ["Alex Smalley", 2, 1, 82.5, 65, 6, -1.75],
    ["Si Woo Kim", 6, 5, 47.8, 14, 22, -0.5],
    ["Gary Woodland", 4, 3, 65.8, 51, 14, -0.91],
    ["Jake Knapp", 2, 2, 64.5, 62, 8, -2.34],
    ["Min Woo Lee", 3, 3, 50.7, 22, 12, -1.96],
    ["Max Homa", 7, 7, 52.4, 6, 27, -1.28],
    ["Hideki Matsuyama", 6, 6, 16.5, 1, 24, 1.43],
    ["Scottie Scheffler", 8, 7, 30.0, 3, 26, 1.31],
    ["Tommy Fleetwood", 6, 6, 18.8, 3, 28, 1.18],
    ["Patrick Cantlay", 7, 7, 21.4, 2, 28, 0.93],
    ["Justin Thomas", 6, 6, 18.3, 1, 24, 1.03],
    ["Sam Burns", 5, 5, 21.4, 5, 20, 1.2],
    ["Collin Morikawa", 6, 6, 18.0, 5, 24, 0.92],
    ["Xander Schauffele", 8, 8, 29.5, 2, 32, 0.62],
    ["Adam Scott", 5, 5, 21.8, 10, 20, 0.82],
    ["J.J. Spaun", 3, 3, 22.7, 2, 12, 1.33],
    ["Viktor Hovland", 6, 6, 27.0, 2, 24, 0.59],
    ["J.T. Poston", 7, 6, 35.3, 18, 26, 0.54],
    ["Russell Henley", 6, 4, 43.3, 6, 20, 0.62],
    ["Sungjae Im", 6, 6, 26.0, 6, 24, 0.51],
    ["Akshay Bhatia", 2, 2, 9.0, 6, 8, 1.41],
    ["Matt Fitzpatrick", 7, 7, 26.9, 4, 28, 0.4],
    ["Maverick McNealy", 3, 3, 23.7, 12, 12, 0.76],
    ["Aaron Rai", 6, 6, 29.3, 12, 24, 0.37],
    ["Rory McIlroy", 6, 5, 39.0, 3, 22, 0.4],
    ["Harris English", 7, 6, 43.0, 4, 26, 0.32],
    ["Sahith Theegala", 4, 4, 24.0, 1, 12, 0.68],
    ["Justin Rose", 6, 5, 34.7, 1, 22, 0.37],
    ["Michael Kim", 3, 3, 31.0, 16, 12, 0.64],
    ["Brian Harman", 5, 5, 28.4, 3, 20, 0.35],
    ["Robert MacIntyre", 4, 4, 29.8, 7, 16, 0.42],
    ["Shane Lowry", 6, 6, 35.7, 6, 24, 0.22],
    ["Keith Mitchell", 4, 4, 37.5, 31, 16, 0.33],
    ["Cameron Young", 4, 4, 32.0, 5, 16, 0.29],
  ],
};

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016];

type YearResult = number | "MC" | "DQ" | "WD" | null;

// Same source screenshot as COURSE_HISTORY above, kept year-by-year instead
// of collapsed to an average - "100" on the sheet becomes "MC" here (and
// the one "DQ" stays labeled as such), both shown in the same red as a
// missed cut everywhere else on the board. Order matches YEARS (2025 ->
// 2019). Keyed by tournament the same way COURSE_HISTORY is, in case
// another course's sheet gets added later.
const YEAR_HISTORY: Record<string, Record<string, YearResult[]>> = {
  "Rocket Classic": {
    // Order: [2025, 2024, 2023, 2022, 2021, 2020, 2019] — 100=MC, null=didn't play
    // Page 1
    "Chris Kirk": [2, 44, 14, 17, 12, 21, null],
    "J.J. Spaun": [null, 10, 33, 8, 32, 30, 13],
    "Taylor Moore": [100, 10, 4, 6, null, null, null],
    "Cam Davis": [100, 1, 17, 14, 1, 100, 100],
    "Cameron Young": [46, 6, null, 2, null, null, null],
    "Rickie Fowler": [100, 31, 1, 100, 32, 12, 46],
    "Sungjae Im": [null, null, 24, null, 8, 53, 21],
    "Davis Thompson": [34, 2, 24, null, 58, null, null],
    "Keegan Bradley": [41, null, 21, 44, 14, 45, null],
    "Lucas Glover": [null, null, 4, 100, 41, 21, null],
    "Hideki Matsuyama": [13, null, 100, null, null, null, null],
    "Taylor Pendrith": [null, 72, 14, 2, null, null, null],
    "Patrick Cantlay": [32, null, null, 2, null, null, null],
    "Tony Finau": [null, null, 100, 1, null, 53, null],
    "Adam Schenk": [100, 100, 7, 100, 41, 30, 42],
    "Max Greyserman": [2, 31, null, null, null, null, null],
    "Ben Griffin": [13, 31, 33, null, null, null, null],
    "Akshay Bhatia": [26, 2, 100, null, null, null, null],
    "Jake Knapp": [4, 31, null, null, null, null, null],
    "Mark Hubbard": [13, 52, 100, 100, 100, 12, null],
    "Wyndham Clark": [100, null, null, 8, null, null, 17],
    "Jason Day": [null, null, null, 17, 14, 100, null],
    "Stephan Jaeger": [100, 100, 9, 5, null, null, 100],
    "Maverick McNealy": [null, 44, null, 100, 21, 8, null],
    "Dylan Wu": [null, 10, 24, 100, null, null, null],
    "Nicolai Hojgaard": [24, 66, 21, null, null, null, null],
    "Jackson Suber": [6, null, null, null, null, null, null],
    "Chad Ramey": [26, 100, 17, 100, null, null, null],
    // Page 2
    "Eric Cole": [null, 6, null, null, null, null, null],
    "Jacob Bridgeman": [26, 31, null, null, null, null, null],
    "Kevin Roy": [8, null, 100, null, null, null, null],
    "Matt Wallace": [46, 100, 78, 10, null, null, 12],
    "Harry Hall": [13, 31, 100, null, null, null, null],
    "Nico Echavarria": [6, 63, 100, null, null, null, null],
    "Luke Clanton": [60, 10, null, null, null, null, null],
    "Vince Whaley": [32, 57, 40, 17, 58, 100, null],
    "Matt McCarty": [19, null, null, null, null, null, null],
    "Zecheng Dou": [null, null, 17, null, null, null, null],
    "Aldrich Potgieter": [1, null, 100, null, null, null, null],
    "Billy Horschel": [null, null, null, null, null, null, 17],
    "Michael Thorbjornsen": [4, 100, null, 100, null, null, null],
    "Patrick Rodgers": [100, 31, null, 44, 41, 45, null],
    "Russell Henley": [null, null, null, 10, null, null, 100],
    "Mackenzie Hughes": [null, null, null, 100, 14, null, 21],
    "Kristoffer Ventura": [34, null, null, null, 100, 21, null],
    "Neal Shipley": [null, 20, null, null, null, null, null],
    "Rico Hoey": [100, 6, null, null, null, null, null],
    "Sam Stevens": [null, 10, 74, null, null, null, null],
    "Kevin Streelman": [null, 57, null, 49, null, null, 35],
    "Joe Highsmith": [34, 57, null, null, null, null, null],
    "Patrick Fishburn": [100, 25, null, null, null, null, null],
    "William Mouw": [34, null, null, null, null, null, null],
    "Chris Gotterup": [26, 67, null, 49, null, null, null],
    "Nick Taylor": [null, null, null, 100, 52, null, 35],
    "Doug Ghim": [19, 100, 33, 100, 32, 100, null],
    "Lee Hodges": [34, 100, 100, 44, null, null, null],
    // Page 3
    "Aaron Wise": [51, null, null, null, null, 100, 35],
    "Ryo Hisatsune": [60, 31, null, null, null, null, null],
    "Adam Svensson": [100, 100, 40, 24, null, null, 100],
    "Denny McCarthy": [null, null, null, 100, 100, null, 21],
    "Andrew Putnam": [8, null, null, null, 100, 100, null],
    "Ben James": [null, 44, null, null, null, null, null],
    "Hank Lebioda": [null, null, 64, 100, 4, 100, 100],
    "Ryan Gerard": [41, null, 56, null, null, null, null],
    "Nick Dunlap": [100, 10, null, null, null, null, null],
    "Takumi Kanaya": [46, null, null, null, null, null, null],
    "Chandler Phillips": [13, 67, null, null, null, 100, null],
    "Webb Simpson": [51, 100, 100, 69, 100, 8, null],
    "Brandt Snedeker": [100, 100, 100, null, 38, 100, 5],
    "Matti Schmid": [null, 52, 100, null, null, null, null],
    "Peter Malnati": [41, 74, 9, 73, 100, 100, 29],
    "Davis Riley": [67, 57, 33, 100, null, null, null],
    "Harris English": [null, null, null, 100, null, null, 55],
    "Brice Garnett": [100, 100, 47, 100, 100, null, 17],
    "Rasmus Hojgaard": [100, null, null, null, null, null, null],
    "Seamus Power": [100, null, null, null, 8, 12, 100],
    "Kevin Yu": [null, 31, 100, null, null, null, null],
    "Pierceson Coody": [null, 63, null, null, null, null, null],
    "Jesper Svensson": [100, null, null, null, null, null, null],
    "Mac Meissner": [100, 100, null, null, null, null, null],
    "Emiliano Grillo": [73, null, null, null, 100, 39, null],
    "Erik van Rooyen": [78, 6, 100, null, null, 100, null],
    "Corey Conners": [null, null, null, null, null, 100, null],
    // Page 4
    "Steven Fisk": [100, null, null, null, null, null, null],
    "Christiaan Bezuidenhout": [null, null, 56, null, null, 100, null],
    "Garrick Higgo": [100, 100, 33, 100, 41, null, null],
    "Brendon Todd": [null, 100, 56, null, 100, 57, null],
    "Jackson Koivun": [null, 100, null, null, null, null, null],
    "Beau Hossler": [60, 31, 100, 69, 25, 100, 100],
    "Austin Smotherman": [null, null, 100, 69, null, null, null],
    "Thorbjorn Olesen": [41, 100, null, null, null, null, null],
    "Trace Crowe": [null, 100, null, null, null, null, null],
    "Gordon Sargent": [67, null, 100, null, null, null, null],
    "Danny Walker": [100, null, null, null, null, null, null],
    "Ricky Castillo": [100, null, null, null, null, null, null],
    "Si Woo Kim": [84, null, null, 14, 58, 57, 100],
    "Adrien Dumont de Chassart": [null, 100, null, null, null, null, null],
    "Joel Dahmen": [100, 25, 100, 100, 21, null, null],
    "David Lipsky": [100, null, 100, 37, null, null, null],
    "Andrew Novak": [null, 20, 100, 100, null, null, null],
    "Karl Vilips": [100, null, null, null, null, null, null],
    "Alejandro Tosti": [100, null, null, null, null, null, null],
    "Max McGreevy": [100, null, 100, 100, null, null, null],
    "Patton Kizzire": [100, 20, 100, 74, 25, 100, 100],
    "Austin Eckroat": [60, null, 100, null, 100, null, null],
    "Zach Bauchou": [null, null, null, null, null, null, 100],
    "Keith Mitchell": [100, 100, null, null, null, null, 100],
    "Michael Kim": [26, 52, null, null, 100, 100, 100],
    "Tom Hoge": [null, null, 100, null, 100, 100, 64],
    "Rafael Campos": [100, 100, null, null, 100, null, null],
  },
  "3M Open": {
    "Tony Finau": ["MC", 12, 7, 1, 28, 3, 23],
    "Emiliano Grillo": [20, 24, 10, 2, "MC", 3, null],
    "Cam Davis": ["MC", 19, 10, 16, 28, 12, "MC"],
    "Brice Garnett": [57, 33, 53, 31, 16, 26, 23],
    "Doug Ghim": ["MC", 24, 27, 16, "MC", 18, null],
    "Adam Hadwin": [44, "MC", "MC", 38, 6, null, 4],
    "Kurt Kitayama": [1, 6, null, null, null, null, null],
    "Cameron Champ": [28, 12, null, 16, 1, null, "MC"],
    "Sam Stevens": [2, 64, 10, null, null, null, null],
    "Adam Svensson": [14, 37, 37, "MC", null, null, 15],
    "Lee Hodges": ["MC", "MC", 1, 16, null, null, null],
    "Hank Lebioda": [null, null, "MC", 16, null, 26, 34],
    "Keith Mitchell": ["MC", 46, 5, null, 5, "MC", 66],
    "Sungjae Im": ["MC", null, "MC", 2, null, null, 15],
    "Maverick McNealy": ["MC", 3, null, 49, 16, null, null],
    "Kevin Streelman": [null, 64, 2, null, null, null, 34],
    "Taylor Moore": [14, 12, null, null, null, null, null],
    "Matt Kuchar": [null, 3, 43, null, "MC", null, null],
    "Patrick Rodgers": ["MC", 37, 37, null, 39, 32, null],
    "Matti Schmid": [61, 12, 20, null, null, null, null],
    "Nick Hardy": [28, 46, 13, 58, null, null, null],
    "Gary Woodland": [20, 37, "MC", null, 11, null, null],
    "Brian Harman": [null, null, null, null, 41, 7, null],
    "Max Greyserman": ["MC", 2, null, null, null, null, null],
    "Patrick Fishburn": [44, 6, null, null, null, null, null],
    "Max Homa": [39, null, null, null, 3, 79, null],
    "David Lipsky": [3, "MC", 43, null, null, null, null],
    "Ben Kohles": [20, 24, null, "MC", null, null, null],
    "Chad Ramey": [28, 24, 53, null, null, null, null],
    "Mackenzie Hughes": [53, 19, 30, null, null, 66, null],
    "Takumi Kanaya": [7, null, null, null, null, null, null],
    "William Mouw": [7, null, null, null, null, null, null],
    "Taylor Pendrith": [68, 5, "MC", null, null, null, null],
    "Tom Kim": [null, null, null, 28, null, null, null],
    "Hideki Matsuyama": [null, null, 30, null, null, null, 7],
    "Troy Merritt": [44, "MC", "MC", 49, 39, "MC", 7],
    "Zac Blair": [44, "MC", 13, null, null, null, null],
    "Tom Hoge": ["MC", "MC", 20, 4, "MC", 46, 23],
    "Chris Kirk": [14, null, null, "MC", 41, null, null],
    "Denny McCarthy": [null, null, null, null, 67, 32, 23],
    "Billy Horschel": [null, null, 13, null, null, null, null],
    "Jesper Svensson": [14, null, null, null, null, null, null],
    "Thorbjorn Olesen": [14, null, null, null, null, null, null],
    "Mac Meissner": [14, 59, null, null, null, null, null],
    "Tyler Duncan": [null, 53, 20, 45, "MC", null, 83],
    "David Skinns": [57, 24, null, 54, null, null, null],
    "Pierceson Coody": [3, 72, null, null, null, null, null],
    "Trace Crowe": [null, 24, null, null, null, null, null],
    "Christiaan Bezuidenhout": [20, null, "MC", null, null, null, null],
    "Austin Eckroat": [39, "MC", "MC", null, 16, null, null],
    "Brandt Snedeker": ["MC", "MC", 53, null, 11, null, null],
    "Andrew Putnam": ["MC", 19, null, 11, "MC", "MC", null],
    "Mark Hubbard": [61, null, "MC", null, 16, null, null],
    "Neal Shipley": [null, 37, null, null, null, null, null],
    "Fabian Gomez": [null, null, null, null, "MC", "MC", 13],
    "Seamus Power": [28, 37, null, null, null, null, null],
    "Garrick Higgo": [39, 37, 13, "MC", null, null, null],
    "Corey Conners": [null, null, null, null, null, 46, null],
    "Beau Hossler": ["MC", "MC", 13, "MC", 49, "MC", 34],
    "Dylan Wu": ["DQ", 53, 5, "MC", null, null, null],
    "Jake Knapp": [3, null, null, null, null, null, null],
    "Davis Riley": ["MC", 46, null, "MC", null, null, null],
    "Matthieu Pavon": [44, null, null, null, null, null, null],
    "Kevin Roy": [28, null, "MC", null, null, null, null],
    "Camilo Villegas": [null, null, 53, 58, 51, null, null],
    "Joe Highsmith": ["MC", 44, null, null, null, null, null],
    "Patton Kizzire": ["MC", "MC", "MC", 38, 39, 46, 34],
    "Aaron Wise": [null, null, null, null, null, "MC", null],
    "Haotong Li": ["MC", null, null, null, null, null, null],
    "Paul Peterson": ["MC", null, null, null, null, null, null],
    "Preston Stout": ["MC", null, null, null, null, null, null],
    "Ricky Castillo": ["MC", null, null, null, null, null, null],
    "Lucas Glover": [null, null, "MC", "MC", null, "MC", 7],
    "Justin Lower": ["MC", 33, 43, "MC", null, null, null],
    "Jeremy Paul": ["MC", null, null, null, null, null, null],
    "Luke List": ["MC", "MC", null, null, 58, 32, "MC"],
    "Hayden Springer": ["MC", 59, null, null, null, null, null],
    "Stephan Jaeger": [null, null, 30, "MC", null, null, 66],
    "Jackson Suber": ["MC", null, null, null, null, null, null],
    "Rico Hoey": [57, 67, null, null, null, null, null],
    "Davis Thompson": [null, null, "MC", null, null, null, null],
    "Luke Clanton": [61, "MC", null, null, null, null, null],
    "Adrien Dumont de Chassart": [null, "MC", null, null, null, null, null],
    "Danny Walker": ["MC", null, null, null, null, null, null],
    "Karl Vilips": ["MC", null, null, null, null, null, null],
    "Joel Dahmen": [39, "MC", "MC", null, 67, null, null],
    "Peter Malnati": ["MC", "MC", "MC", 11, "MC", "MC", 46],
    "Kevin Yu": ["MC", 73, 37, null, null, null, null],
    "Jason Day": [null, null, null, 64, null, null, 66],
    "Austin Smotherman": [null, 53, "MC", 24, null, null, null],
    "Max McGreevy": ["MC", null, 30, "MC", null, null, null],
    "Ben James": [null, "MC", null, null, null, null, null],
    "Gordon Sargent": ["MC", null, null, null, null, null, null],
    "Steven Fisk": [74, null, null, null, null, null, null],
    "Zecheng Dou": [null, null, "MC", null, null, null, null],
    "Lanto Griffin": ["MC", 44, "MC", null, "MC", null, null],
    "Chandler Phillips": ["MC", "MC", null, null, null, null, null],
    "Kris Ventura": [null, null, null, "MC", "MC", null, null],
    "Adam Schenk": ["MC", 59, null, 54, 51, 41, "MC"],
    "S.Y. Noh": [null, null, 69, 38, null, null, null],
    "Ryan Fox": [null, null, "MC", null, null, null, null],
    "Vince Whaley": [57, null, null, null, "MC", "MC", null],
    "Nicholas Lindheim": [null, "MC", null, null, null, null, null],
    "Michael Kim": [null, "MC", "MC", null, 39, "MC", null],
    "Harry Higgs": [25, null, "MC", "MC", "MC", "MC", null],
    "Ben Silverman": [61, 53, null, null, null, null, "MC"],
    "Nick Dunlap": ["MC", "MC", null, null, null, null, null],
    "Ben Martin": [null, "MC", "MC", "MC", "MC", null, null],
    "Thomas Campbell": ["MC", null, null, null, null, null, null],
    "Alejandro Tosti": [null, "MC", null, null, null, null, null],
    "Erik van Rooyen": ["MC", "MC", "MC", null, 58, "MC", null],
    "Ryan Brehm": ["MC", "MC", "MC", 31, 51, "MC", null],
    "Rafael Campos": ["MC", "MC", null, null, "MC", null, null],
    "Will Gordon": ["MC", "MC", "MC", null, null, null, null],
  },
  "Wyndham Championship": {
    "Webb Simpson": [27, "MC", 5, null, 7, 3, 2, 2, 3, 72],
    "Billy Horschel": [null, 7, 4, 27, null, 2, 6, 11, 60, 5],
    "Sungjae Im": [27, 41, 14, 2, 24, 9, 6, null, null, null],
    "Denny McCarthy": [11, 33, "MC", "MC", 15, 9, 22, 36, null, null],
    "J.T. Poston": [11, "MC", 7, 21, "MC", "MC", 1, "MC", 50, null],
    "Mark Hubbard": [3, "MC", "MC", 61, 51, 15, null, null, 24, "MC"],
    "Cameron Young": [1, 22, null, null, null, null, null, null, null, null],
    "Ben Griffin": [11, 7, "MC", 4, null, null, null, null, null, null],
    "Aaron Rai": [5, 1, "MC", 71, null, null, null, null, null, null],
    "Chris Kirk": [5, null, "MC", null, 29, 51, null, 11, null, 46],
    "Cam Davis": [44, "MC", 7, null, 15, 22, null, null, null, null],
    "Harris English": [null, null, 33, "MC", null, 23, 39, 11, 50, 46],
    "Brandt Snedeker": ["MC", "MC", 45, null, "MC", 42, 39, 1, null, 3],
    "Mac Meissner": [2, 12, null, null, null, null, null, null, null, null],
    "Davis Thompson": [11, 12, 22, null, "MC", null, null, null, null, null],
    "Hideki Matsuyama": [19, null, "MC", null, "MC", null, "MC", 11, null, 3],
    "Lucas Glover": ["MC", "MC", 1, 54, "MC", "MC", 72, null, 28, 22],
    "Bud Cauley": ["MC", "MC", null, null, null, 15, 22, null, 42, 10],
    "Adam Svensson": ["MC", 7, 7, 78, null, 31, null, null, null, null],
    "Brice Garnett": ["MC", 41, "MC", "MC", 51, "MC", 6, 20, null, 20],
    "Matt Kuchar": [44, 12, 38, null, 29, null, null, null, null, null],
    "Patrick Rodgers": [15, 33, "MC", 36, "MC", 66, 81, 24, null, null],
    "Taylor Moore": ["MC", 52, 22, 5, null, null, null, null, null, null],
    "Alex Noren": [3, null, 38, null, null, 60, null, null, null, null],
    "Max McGreevy": [34, null, 51, 5, null, null, null, null, null, null],
    "Tom Kim": ["WD", null, 1, null, null, null, null, null, null, null],
    "Max Greyserman": ["MC", 2, null, null, null, null, null, null, null, null],
    "Nick Taylor": [null, "MC", null, 81, 10, null, "MC", 8, 50, "MC"],
    "Nico Echavarria": [19, 22, "MC", null, null, null, null, null, null, null],
    "Brian Harman": [null, 45, null, 71, "MC", 27, 6, null, null, null],
    "Jackson Koivun": [5, null, null, null, null, null, null, null, null, null],
    "Patrick Fishburn": [8, "MC", null, null, null, null, null, null, null, null],
    "Matt McCarty": [8, null, null, null, null, null, null, null, null, null],
    "Matt Wallace": [27, 28, 45, "MC", null, "MC", null, null, null, null],
    "Peter Malnati": [62, "MC", "MC", 27, "MC", 20, "MC", 24, 50, 42],
    "Christiaan Bezuidenhout": [62, 22, 51, 47, null, 37, null, null, null, null],
    "Alex Smalley": ["MC", "MC", "MC", 13, 29, null, null, null, null, null],
    "Aaron Wise": ["WD", null, 13, 46, "MC", 48, null, null, null, null],
    "C.T. Pan": [null, null, 64, null, 29, 69, null, 2, 63, null],
    "Keegan Bradley": ["MC", 22, null, null, null, null, 42, 46, null, null],
    "Keith Mitchell": ["MC", 12, null, 54, 55, "MC", null, 41, null, null],
    "Trace Crowe": [null, 7, null, null, null, null, null, null, null, null],
    "Andrew Putnam": ["MC", "MC", 27, 27, "MC", null, null, null, null, null],
    "Eric Cole": [74, 7, 14, null, null, null, null, null, null, null],
    "Doug Ghim": ["MC", 51, "MC", "MC", "MC", null, 20, null, null, null],
    "Patton Kizzire": [44, "MC", "MC", "MC", "MC", 51, 13, null, 24, 53],
    "Karl Vilips": [19, null, null, null, null, null, null, null, null, null],
    "Luke Clanton": [67, 5, null, null, null, null, null, null, null, null],
    "Austin Eckroat": ["MC", 6, "MC", null, 37, null, null, null, null, null],
    "Ricky Castillo": [23, null, null, null, null, null, null, null, null, null],
    "Chandler Phillips": [34, 38, null, null, null, null, null, null, null, null],
    "Matti Schmid": [31, 64, 22, null, null, null, null, null, null, null],
    "Justin Thomas": [null, null, 12, null, null, null, null, null, null, "MC"],
    "David Lipsky": [44, "MC", 45, 27, null, null, null, null, null, null],
    "Lanto Griffin": [23, null, null, null, "MC", null, null, 57, null, null],
    "Davis Riley": ["MC", 38, "MC", 13, null, null, null, null, null, null],
    "Rasmus Hojgaard": [34, null, null, null, null, null, null, null, null, null],
    "Rico Hoey": [67, 22, null, null, null, null, null, null, null, null],
    "Beau Hossler": [15, 12, "MC", null, 65, "MC", "MC", null, null, null],
    "Austin Smotherman": [null, 28, "MC", "MC", null, null, null, null, null, null],
    "Mackenzie Hughes": [null, 28, "MC", "MC", 37, null, 22, 66, null, null],
    "Stephan Jaeger": ["MC", "MC", 14, 13, null, null, "MC", 70, null, null],
    "Justin Lower": [44, 33, "MC", 36, null, null, null, null, null, null],
    "William Mouw": [38, null, null, null, null, null, null, null, null, null],
    "Ben Kohles": ["MC", "MC", null, 54, null, null, null, null, null, null],
    "Ryo Hisatsune": ["MC", 3, null, null, null, null, null, null, null, null],
    "Tony Finau": [44, null, null, null, null, null, null, null, null, null],
    "Zecheng Dou": [null, null, 51, null, null, null, "MC", null, null, null],
    "Daniel Berger": [null, 45, null, null, null, 39, "MC", null, null, null],
    "Takumi Kanaya": ["MC", null, null, null, null, null, null, null, null, null],
    "Seamus Power": [44, 28, null, null, 60, 27, 60, "MC", 83, null],
    "Kristoffer Ventura": ["MC", null, null, "MC", 37, null, null, null, null, null],
    "Brian Campbell": ["MC", null, null, null, null, null, null, null, null, "MC"],
    "Steven Fisk": [60, null, null, null, null, null, null, null, null, null],
    "Adrien Dumont de Chassart": [null, "MC", null, null, null, null, null, null, null, null],
    "Taylor Pendrith": [null, null, "MC", 13, null, null, null, null, null, null],
    "Kevin Streelman": [null, "MC", "MC", "MC", 7, null, "MC", null, 72, null],
    "Lee Hodges": [55, "MC", null, 47, null, null, null, null, null, null],
    "Andrew Novak": ["MC", 52, 33, "MC", null, null, null, null, null, null],
    "Jordan Spieth": [31, "MC", null, null, 72, 78, null, null, null, null],
    "Haotong Li": [null, null, null, null, null, null, null, "MC", null, null],
    "Harry Hall": [15, "MC", "MC", null, null, null, null, null, null, null],
    "Kevin Roy": ["MC", null, "MC", null, null, null, null, null, null, null],
    "Ryan Gerard": ["MC", null, "MC", null, null, null, null, null, null, null],
    "Thorbjorn Olesen": [62, "MC", null, null, null, null, null, null, null, null],
    "Joel Dahmen": [15, 64, 64, 81, "MC", null, 53, null, 42, null],
    "Danny Walker": ["MC", null, null, null, null, null, null, null, null, null],
    "Gordon Sargent": ["MC", null, null, null, null, null, null, null, null, null],
    "Emiliano Grillo": [44, 59, null, null, null, null, null, "MC", null, null],
    "Brooks Koepka": [null, null, null, null, "MC", null, null, null, null, null],
    "Jesper Svensson": ["MC", null, null, null, null, null, null, null, null, null],
    "Joe Highsmith": ["MC", "MC", null, null, null, null, null, null, null, null],
    "Nick Dunlap": ["MC", "MC", null, null, null, null, null, null, null, null],
    "Matthieu Pavon": [72, null, null, null, null, null, null, null, null, null],
    "Maverick McNealy": [null, 45, null, null, "MC", null, null, null, null, null],
    "Jackson Suber": ["MC", null, null, null, null, null, null, null, null, null],
    "Alejandro Tosti": [null, "MC", null, null, null, null, null, null, null, null],
    "Tom Hoge": [null, null, null, "MC", 27, 77, 20, "MC", "MC", null],
    "Sepp Straka": [null, null, null, "MC", 15, "MC", 39, null, null, null],
    "Erik van Rooyen": ["WD", "MC", "MC", null, 37, null, null, null, null, null],
    "Hank Lebioda": [null, null, "MC", "MC", "MC", 42, 78, null, null, null],
    "Chad Ramey": ["MC", 52, "MC", "MC", null, null, null, null, null, null],
    "Sahith Theegala": ["MC", null, null, null, null, null, null, null, null, null],
    "Pierceson Coody": ["MC", 61, null, null, null, null, null, null, null, null],
    "Rafael Campos": ["MC", "MC", null, 74, null, null, null, null, null, null],
    "Zac Blair": ["MC", 45, "MC", null, "MC", null, "MC", null, 80, null],
    "Sam Stevens": ["MC", "MC", "MC", null, null, null, null, null, null, null],
    "Garrick Higgo": ["MC", "MC", "MC", "MC", null, null, null, null, null, null],
    "Kevin Yu": ["MC", "MC", "MC", null, null, null, null, null, null, null],
    "Vince Whaley": [74, 63, null, "MC", "MC", 37, null, null, null, null],
    "Dylan Wu": [null, "MC", 51, "MC", null, null, null, null, null, null],
    "Adam Schenk": ["MC", "MC", 64, "MC", "MC", 51, "MC", "MC", null, null],
    "Michael Kim": [62, null, 5, null, 65, "MC", "MC", null, 64, 75],
  },
  "FedEx St. Jude Championship": {
    "Ludvig Aberg": [9, 40, null, null, null, null, null, null, null, null],
    "Tom Kim": [null, 50, 24, 13, null, null, null, null, null, null],
    "Ben Griffin": [9, 50, 24, null, null, null, null, null, null, null],
    "Jacob Bridgeman": [17, null, null, null, null, null, null, null, null, null],
    "Eric Cole": [null, 18, 31, null, null, null, null, null, null, null],
    "Sepp Straka": [17, 61, 63, 2, null, null, null, null, null, null],
    "Harry Hall": [22, null, null, null, null, null, null, null, null, null],
    "Bud Cauley": [14, null, null, null, null, null, null, null, null, null],
    "Kurt Kitayama": [9, null, 52, "MC", null, null, null, null, null, null],
    "Rickie Fowler": [6, null, 58, 64, null, 15, null, "MC", null, null],
    "Alex Noren": [null, 30, null, null, null, null, 12, null, null, null],
    "Matti Schmid": [38, null, null, null, null, null, null, null, null, null],
    "Nico Echavarria": [38, null, null, null, null, null, null, null, null, null],
    "Corey Conners": [50, 50, 6, 28, 36, 30, 27, 68, null, null],
    "Ryan Gerard": [44, null, null, null, null, null, null, null, null, null],
    "Jordan Spieth": [38, 68, 6, "MC", 12, 30, 12, null, null, null],
    "Wyndham Clark": [56, 7, 66, 28, null, null, null, null, null, null],
    "Ryan Fox": [50, null, null, null, null, null, null, null, null, null],
    "Nick Taylor": [44, 65, 24, "MC", null, 35, null, 30, null, null],
    "Chris Gotterup": [54, null, null, null, null, null, null, null, null, null],
    "Sam Stevens": [54, null, 37, null, null, null, null, null, null, null],
    "Aldrich Potgieter": [59, null, null, null, null, null, null, null, null, null],
    "Patrick Rodgers": [38, 33, 52, "MC", null, null, null, null, null, null],
    "Alex Smalley": [null, 65, "MC", null, null, null, null, null, null, null],
    "Si Woo Kim": [14, 50, 16, 42, 65, null, null, null, null, "MC"],
    "Gary Woodland": [null, null, null, 51, null, 57, 55, null, null, "MC"],
    "Jake Knapp": [62, 67, null, null, null, null, null, null, null, null],
    "Min Woo Lee": [68, 22, null, 62, null, null, null, null, null, null],
    "Max Homa": [null, 70, 6, 42, 51, 52, 61, null, 85, null],
    "Hideki Matsuyama": [17, 1, 16, null, 2, 20, 43, null, null, null],
    "Scottie Scheffler": [3, 22, 3, 31, "MC", 14, 15, 43, null, null],
    "Tommy Fleetwood": [3, 22, 3, null, 46, 35, 4, null, null, null],
    "Patrick Cantlay": [9, 12, 2, 57, 23, 35, 12, null, null, null],
    "Justin Thomas": [28, 30, null, 13, 26, 1, 12, null, null, null],
    "Sam Burns": [28, 5, 52, 20, 20, null, null, null, null, null],
    "Collin Morikawa": [22, 22, 13, 5, 26, 20, null, null, null, null],
    "Xander Schauffele": [22, 2, 24, 57, 46, 6, 27, null, 52, null],
    "Adam Scott": [null, 18, null, 57, 36, null, 40, null, 10, null],
    "J.J. Spaun": [2, null, 24, 42, null, null, null, null, null, null],
    "Viktor Hovland": [32, 2, 13, 20, 36, 59, null, null, null, null],
    "J.T. Poston": [22, 33, 24, 20, null, 30, null, 18, "MC", null],
    "Russell Henley": [17, 30, 6, "MC", null, null, null, "MC", 7, null],
    "Sungjae Im": [17, 40, 6, 12, 46, 35, null, null, null, null],
    "Akshay Bhatia": [6, 12, null, null, null, null, null, null, null, null],
    "Matt Fitzpatrick": [32, 18, 66, 5, 57, 6, 4, null, null, null],
    "Maverick McNealy": [28, 12, null, 31, null, null, null, null, null, null],
    "Aaron Rai": [22, 16, 49, 51, 26, null, 12, null, null, null],
    "Rory McIlroy": [null, 68, 3, "MC", 12, 47, 4, null, null, null],
    "Harris English": [48, 61, 52, null, 4, null, null, "MC", 10, 26],
    "Sahith Theegala": [1, 46, 13, null, 15, null, null, null, null, null],
    "Justin Rose": [1, 22, 20, "MC", 54, null, 11, null, null, null],
    "Michael Kim": [59, null, null, null, null, null, 18, null, 16, null],
    "Brian Harman": [22, 50, 31, 3, 36, null, null, null, null, null],
    "Robert MacIntyre": [38, 7, null, null, 15, 59, null, null, null, null],
    "Shane Lowry": [59, 50, null, 46, 23, 6, null, 30, null, null],
    "Keith Mitchell": [null, null, 43, 31, null, null, 39, 37, null, null],
    "Cameron Young": [5, 61, 31, 31, null, null, null, null, null, null],
  },
};

type SortKey = "name" | "app" | "made" | "rate" | "avg" | "best" | "rounds" | "sgAvg";

function rateOf(r: PlayerRow): number {
  return r.app > 0 ? (r.made / r.app) * 100 : 0;
}

function rateColor(r: number): string {
  if (r >= 70) return "var(--live)";
  if (r >= 40) return "var(--gold-bright)";
  return "var(--clay)";
}

// Renders only for tournaments we actually have a transcribed sheet for -
// returns null otherwise, so adding this to the upcoming-tournament card
// is a no-op for every other event until more course-history data gets
// added to COURSE_HISTORY above.
export default function CourseHistoryTable({ tournamentName }: { tournamentName: string }) {
  const raw = COURSE_HISTORY[tournamentName];
  const yearHistory = YEAR_HISTORY[tournamentName] || {};
  const [query, setQuery] = useState("");
  const [minApp, setMinApp] = useState(2);
  const [sortKey, setSortKey] = useState<SortKey>("rate");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);

  const allRows: PlayerRow[] = useMemo(
    () => (raw || []).map(([name, app, made, avg, best, rounds, sgAvg]) => ({ name, app, made, avg, best, rounds, sgAvg })),
    [raw]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = allRows.filter((r) => r.app >= minApp && r.name.toLowerCase().includes(q));
    filtered = filtered.slice().sort((a, b) => {
      const av = sortKey === "rate" ? rateOf(a) : (a as any)[sortKey];
      const bv = sortKey === "rate" ? rateOf(b) : (b as any)[sortKey];
      const avn = av === null ? (sortKey === "best" ? 9999 : av) : av;
      const bvn = bv === null ? (sortKey === "best" ? 9999 : bv) : bv;
      if (typeof avn === "string") return sortDir * avn.localeCompare(bvn);
      return sortDir * (avn - bvn);
    });
    return filtered;
  }, [allRows, query, minApp, sortKey, sortDir]);

  const yearsWithData = YEARS.filter((_, i) =>
    Object.values(yearHistory).some((arr) => arr[i] !== undefined && arr[i] !== null)
  );
  const yearRangeLabel = yearsWithData.length > 0
    ? `${Math.min(...yearsWithData)}-${Math.max(...yearsWithData)}`
    : "2019-2025";

  if (!raw) return null;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    // avg and best finish: lower number = better, so ascending on first click
    else { setSortKey(key); setSortDir((key === "name" || key === "avg" || key === "best") ? 1 : -1); }
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "name", label: "Player" },
    { key: "app", label: "Apps" },
    { key: "made", label: "Made" },
    { key: "rate", label: "Cut rate" },
    { key: "avg", label: "Avg finish" },
    { key: "best", label: "Best finish" },
    { key: "rounds", label: "Rounds" },
    { key: "sgAvg", label: "SG/round" },
  ];

  return (
    <div style={{ marginTop: 14 }}>
      <div className="subline" style={{ marginBottom: 8 }}>Course history · {tournamentName}</div>
      <div style={{ fontSize: 11, color: "var(--cream-dim)", lineHeight: 1.5, marginBottom: 10, maxWidth: 640 }}>
        Every appearance {yearRangeLabel}, reshaped around make-cut rate and finish average - strokes gained kept as a secondary sort.
        Data from Betsperts/Ron Klos.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <input
          type="text"
          placeholder="Search player…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)", color: "var(--cream)",
            fontFamily: "'JetBrains Mono',monospace", fontSize: 12, padding: "6px 10px", borderRadius: 4, minWidth: 180,
          }}
        />
        <select
          value={minApp}
          onChange={(e) => setMinApp(parseInt(e.target.value, 10))}
          style={{
            background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)", color: "var(--cream)",
            fontFamily: "'JetBrains Mono',monospace", fontSize: 11, padding: "6px 8px", borderRadius: 4,
          }}
        >
          <option value={0}>All sample sizes</option>
          <option value={2}>2+ appearances</option>
          <option value={3}>3+ appearances</option>
          <option value={5}>5+ appearances</option>
        </select>
        <span style={{ fontSize: 10, color: "var(--cream-dim)", marginLeft: "auto" }}>{rows.length} players</span>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 6, background: "rgba(0,0,0,0.15)", maxHeight: 420 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  style={{
                    textAlign: c.key === "name" ? "left" : "right",
                    padding: "8px 10px", background: "rgba(0,0,0,0.25)",
                    color: sortKey === c.key ? "var(--gold-bright)" : "var(--cream-dim)",
                    fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", fontSize: 10,
                    cursor: "pointer", whiteSpace: "nowrap", borderBottom: "1px solid var(--line)",
                    position: "sticky", top: 0,
                  }}
                >
                  {c.label}{sortKey === c.key ? (sortDir === 1 ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rate = rateOf(r);
              const history = yearHistory[r.name];
              // Only show year chips if non-null count matches apps count —
              // silently hides expand for rows with incomplete transcribed data.
              const nonNull = history ? history.filter((v: any) => v !== null).length : 0;
              const historyVerified = history && nonNull === r.app;
              const isOpen = openPlayer === r.name;
              return (
                <Fragment key={r.name}>
                  <tr>
                    <td
                      onClick={() => historyVerified && setOpenPlayer(isOpen ? null : r.name)}
                      style={{
                        padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", color: "var(--cream)", fontWeight: 600, whiteSpace: "nowrap",
                        cursor: historyVerified ? "pointer" : "default",
                        textDecoration: historyVerified ? "underline" : "none", textDecorationStyle: "dotted", textDecorationColor: "var(--cream-dim)",
                      }}
                    >
                      {r.name}
                    </td>
                    <td style={{ padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", textAlign: "right" }}>{r.app}</td>
                    <td style={{ padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", textAlign: "right" }}>{r.made}</td>
                    <td style={{ padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                        <div style={{ width: 46, height: 5, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${rate}%`, height: "100%", background: rateColor(rate) }} />
                        </div>
                        <span style={{ color: rateColor(rate) }}>{rate.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", textAlign: "right" }}>{r.avg.toFixed(1)}</td>
                    <td style={{ padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", textAlign: "right" }}>{r.best === null ? "—" : r.best}</td>
                    <td style={{ padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", textAlign: "right" }}>{r.rounds}</td>
                    <td style={{ padding: "6px 10px", borderBottom: isOpen ? "none" : "1px solid var(--line)", textAlign: "right", color: r.sgAvg >= 0 ? "var(--live)" : "var(--clay)" }}>
                      {r.sgAvg > 0 ? "+" : ""}{r.sgAvg.toFixed(2)}
                    </td>
                  </tr>
                  {isOpen && historyVerified && (
                    <tr>
                      <td colSpan={8} style={{ padding: "4px 10px 12px", borderBottom: "1px solid var(--line)", background: "rgba(0,0,0,0.15)" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {YEARS.map((year, i) => {
                            const val = history[i];
                            if (val === undefined || val === null) return null;
                            const missed = val === "MC" || val === "DQ" || val === "WD";
                            return (
                              <div
                                key={year}
                                style={{
                                  minWidth: 46, textAlign: "center", padding: "5px 8px", borderRadius: 5,
                                  border: `1px solid ${missed ? "rgba(192,106,76,0.4)" : "var(--line)"}`,
                                  background: missed ? "rgba(192,106,76,0.08)" : "rgba(228,190,74,0.05)",
                                }}
                              >
                                <div style={{ fontSize: 9, color: "var(--cream-dim)" }}>{year}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: missed ? "var(--clay)" : "var(--cream)" }}>
                                  {missed ? val : val}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
