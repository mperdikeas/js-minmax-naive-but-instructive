// @flow
'use strict';

// The rationale behind using this idiom is described in:
//     http://stackoverflow.com/a/36628148/274677
//
if (!global._babelPolyfill) // https://github.com/s-panferov/awesome-typescript-loader/issues/121
    require('babel-polyfill');
// The above is important as Babel only transforms syntax (e.g. arrow functions)
// so you need this in order to support new globals or (in my experience) well-known Symbols, e.g. the following:
//
//     console.log(Object[Symbol.hasInstance]);
//
// ... will print 'undefined' without the the babel-polyfill being required.


import _ from 'lodash';
import {assert} from 'chai';

import type {Stringifier, Predicate} from 'flow-common-types';

import {Node} from 'simple-trees';


/*
Guide to naming conventions used
-------------------------------
GTP            : Generic Type Parameter
{T/I}SomeType  : Interface or Type (respectively) for class or object structural (not nominal) typing
SomeFunctionFT : Function Type
*/


export type BrancherFT<GameStateGTP, MoveGTP> = (GameStateGTP)=>Array<MoveGTP>

export type IGameRules<GameStateGTP, MoveGTP> = {|
    /* The framework will *never* call the brancher on a terminal state so you don't have to handle that state.
       If you don't trust, me simply return [] on a terminal state even though you can just as well throw an
       exception in that case as execution will never reach that path.
     */
//    brancher             (gs: GameStateGTP)               : Array<MoveGTP>;
    brancher            : BrancherFT<GameStateGTP, MoveGTP>,
    nextState            (gs: GameStateGTP, move: MoveGTP): GameStateGTP,
    isTerminalState      (gs: GameStateGTP)               : boolean
|}




/* The evaluator function will ***always*** evaluate from the perspective of the moving player
   (we assume that information on which player is moving is embedded in the GameStateGTP)
   positive infinity means  WIN  or hugely    favourable situation for the moving player
   negative --------------- LOSS ---------- unfavourable ------------------------------

   Note that in the general case it is possible for a game's terminal state to have
   an evaluation that's neither positive nor negative infinity (e.g. if the game allows
   draws or some other graded outcome).

   The evaluator function has no concept of "maximizing" or "minimizing" player. This is an artifact
   of the minmax algorithm. The evaluator function simply reports from the perspective of the moving
   player and the minmax implementation (that constructs the game tree) takes account of who the
   maximizing or minimizing player is and proceeds accordingly. I.e., it effectively multiplies the
   return value of the evaluator function by +1 or -1 respectively.
 */

export type EvaluatorFT <GameStateGTP> = (gs: GameStateGTP) => number;

export type TMinMaxResult<MoveGTP> =
    {|
        bestMove  : MoveGTP,
        evaluation: number
    |}


export type TMinMaxStatistics =
    {|
     totalNodesVisited: number,
     leafNodesEvaluated: number,
     pruningCount: number
     |};

/* The minmax function type (MinMaxFT) returns both the best move and the evaluation of the root
   node. It assumes that the moving player at the root is also the maximizing player.
 */
export type MinMaxFT<GameStateGTP, MoveGTP> =
    (gameState   : GameStateGTP
     , gameRules : IGameRules<GameStateGTP, MoveGTP>
     , evaluator: EvaluatorFT<GameStateGTP>
     , plies: number
     , statisticsHook: ?TMinMaxStatistics
    ) => TMinMaxResult<MoveGTP>;



