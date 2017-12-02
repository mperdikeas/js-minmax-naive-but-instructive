// @flow
'use strict'; 
require('source-map-support').install();
import 'babel-polyfill';
import {assert}          from 'chai';
import AssertionError    from 'assertion-error';
assert.isOk(AssertionError);
import           _ from 'lodash';
assert.isOk(_);
import {Node}            from 'simple-trees';
assert.isOk(Node);

/*
 *
 *    We're going to test a very silly game:
 *    Each player can choose one of three letters 'A', 'B' and 'C'
 *    If the player chooses the letter his opponent chose in the previous round, he LOSES the game.
 *    With perfect play, the game should never end.
 *
 *    MoveGTP         will be the type Letter
 *    GameStateGTP    will be the class GameState
 *
 *    This is such a simple game that the brancher function does not depend on whose turn it is to
 *    move (there's no concept of 'pieces' belonging to any of the players), and as such, there's
 *    no need for the game state class to keep track of whose turn it is to play.
 *
 */

type Letter = 'a' | 'b' | 'c';


import type {IGameRules}                       from '../src/index.js';
import type {EvaluatorFT}                      from '../src/index.js';
import type {TMinMaxResult}                    from '../src/index.js';

import      {minmax}                           from '../src/index.js';
import      {minmaxRecur}                      from '../src/index.js';

// importation of types that the client programmer will NOT normally have to encounter
import      {generateMoveTree}                 from '../src/minmax-impl.js';
import      {GameTreeNode}                     from '../src/minmax-impl.js';
import      {evaluateLeafNodes}                from '../src/minmax-impl.js';
import      {pullUpNodesEvaluationWithMinmax}  from '../src/minmax-impl.js';
import type {TMinMaxStatistics}                from '../src/minmax-interface.js';



class GameState {
    prevLetter    : ?Letter;
    letter        : ?Letter;

    
    newState(newLetter: Letter): GameState {
        return new GameState(this.letter, newLetter);
    }

    isTerminalState(): boolean {
        return (this.letter!==null) && (this.prevLetter!==null) && (this.letter===this.prevLetter);
    }

    constructor (prevLetter: ?Letter, letter: ?Letter) {
        assert.isTrue(prevLetter!==undefined);
        assert.isTrue(letter!==undefined);
        this.prevLetter = prevLetter;
        this.letter = letter;
    }
}

function newStatistics(): TMinMaxStatistics {
    return {
        totalNodesVisited: 0,
        leafNodesEvaluated: 0,
        pruningCount: 0
    };
}

const GameRules: IGameRules<GameState, Letter> = (function(){

    function brancher(gs: GameState): Array<Letter> {
        return ['a', 'b', 'c'];
    }

    function nextState(gs: GameState, move: Letter) {
        return gs.newState(move);
    }

    function isTerminalState(gs: GameState): boolean {
        return gs.isTerminalState();
    }

    return {
        brancher: brancher,
        nextState: nextState,
        isTerminalState: isTerminalState
    };
})();

function stringifier(x : GameTreeNode<GameState>) : string {
    function s(s: ?string) {
        return s==null?".":s;
    }
    const prevLetter : string = s(x.gameState.prevLetter);
    const letter     : string = s(x.gameState.letter);
    const ev         : string = x.evaluation==null?'?':x.effectiveEvaluation().toString();
    return `letr: ${prevLetter}-${letter}, end state? ${x.gameState.isTerminalState()?'Y':'N'} ev: ${ev}, ${x.maximizingNode?'MAX':'MIN'}`;
}



function evaluator(gs: GameState): number {
    const lettersMatch: boolean = (gs.prevLetter===gs.letter) && (gs.letter!==null);
    if (lettersMatch)
        return Number.POSITIVE_INFINITY; // if the letters match then the player who just finished his move lost the game so the player who's to move next (the 'moving player') WON
    else
        return 0;
}

(evaluator: EvaluatorFT<GameState>);


function allNonTerminalNodesAreEvaluatedToZero(tree: Node<GameTreeNode<GameState>, Letter>) {

    tree.depthFirstTraversal(function(x: Node<GameTreeNode<GameState>, Letter>) {
        if (!x.value.gameState.isTerminalState()) {
            if (x.value.evaluation!=null) {
                assert.isTrue(x.value.evaluation===0, `evaluation was: ${x.value.evaluation}`);
            } else
                assert.fail('at this point all nodes should be evaluated');
        }
    }, true, true);
}

describe('minmax on letter game', function() {

    describe('generateMoveTree', function() {
        describe('does not break for ...', function() {
            function moveTree(depth: number): Node<GameTreeNode<GameState>, Letter> {
                const rv: Node<GameTreeNode<GameState>, Letter>
                          = generateMoveTree(new GameState(null, null), GameRules, depth);
                return rv;
            }
            function moveTreeOnlyEndStatesEvaluated(depth: number): Node<GameTreeNode<GameState>, Letter> {
                const rv : Node<GameTreeNode<GameState>, Letter> = moveTree(depth);
                evaluateLeafNodes(rv, evaluator);
                return rv;
            }
            function moveTreeOnlyEndStatesEvaluatedStringified(depth: number): string {
                const rv : Node<GameTreeNode<GameState>, Letter> =  moveTreeOnlyEndStatesEvaluated(depth);
                return rv.print(stringifier);
            }
            function moveTreeAllStatesEvaluatedStringified(depth: number): string {
                const rv : Node<GameTreeNode<GameState>, Letter> =  moveTreeOnlyEndStatesEvaluated(depth);
                pullUpNodesEvaluationWithMinmax(rv);
                allNonTerminalNodesAreEvaluatedToZero(rv); // this must be true, precisely because the game is undecided with perfect play
                return rv.print(stringifier);
            }
            describe('depth 0', function() {
                it('only leaves evaluated', function() {
                    const s: string = moveTreeOnlyEndStatesEvaluatedStringified(0);
                    assert.strictEqual(s, 'ROOT node #0 with value: letr: .-., end state? N ev: 0, MAX');
                });
                it('all nodes evaluated', function() {
                    const s: string = moveTreeAllStatesEvaluatedStringified(0);
                    assert.strictEqual(s, 'ROOT node #0 with value: letr: .-., end state? N ev: 0, MAX');
                });
            });
            describe('depth 1', function() {
                it ('only leaves evaluated', function() {
                    const s: string = moveTreeOnlyEndStatesEvaluatedStringified(1);
                    assert.strictEqual(s,
                                       `
ROOT node #0 with value: letr: .-., end state? N ev: ?, MAX
node #0 ~~[a]~~> node #1 with value: letr: .-a, end state? N ev: 0, MIN
node #0 ~~[b]~~> node #2 with value: letr: .-b, end state? N ev: 0, MIN
node #0 ~~[c]~~> node #3 with value: letr: .-c, end state? N ev: 0, MIN

`.trim()                           );
                });
                it ('all nodes evaluated', function() {
                    const s: string = moveTreeAllStatesEvaluatedStringified(1);
                    assert.strictEqual(s,
                                       `
ROOT node #0 with value: letr: .-., end state? N ev: 0, MAX
node #0 ~~[a]~~> node #1 with value: letr: .-a, end state? N ev: 0, MIN
node #0 ~~[b]~~> node #2 with value: letr: .-b, end state? N ev: 0, MIN
node #0 ~~[c]~~> node #3 with value: letr: .-c, end state? N ev: 0, MIN

`.trim()                           );
                });
                it('minmax', function() {
                    const s: TMinMaxResult<Letter> = minmax(new GameState(null, null)
                                             , GameRules
                                             , evaluator
                                             , 1);
                    assert.strictEqual(s.bestMove, 'a');
                });
                it('minmax-recur', function() {
                    const stats: TMinMaxStatistics = newStatistics();
                    const s: TMinMaxResult<Letter> = minmaxRecur(new GameState(null, null)
                                                                 , GameRules
                                                                 , evaluator
                                                                 , 1
                                                                 , stats);
                    assert.strictEqual(s.bestMove, 'a');
                    assert.strictEqual(s.evaluation, 0); // (since the game never finishes with perfect play)
                    assert.strictEqual(stats.totalNodesVisited , 4);
                    assert.strictEqual(stats.leafNodesEvaluated, 3);
                });
            });
            describe('depth 2', function() {
                it('only leaves evaluated', function() {
                const s: string = moveTreeOnlyEndStatesEvaluatedStringified(2);
                assert.strictEqual(s,
`
ROOT node #0 with value: letr: .-., end state? N ev: ?, MAX
node #0 ~~[a]~~> node #1 with value: letr: .-a, end state? N ev: ?, MIN
node #1 ~~[a]~~> node #2 with value: letr: a-a, end state? Y ev: Infinity, MAX
node #1 ~~[b]~~> node #3 with value: letr: a-b, end state? N ev: 0, MAX
node #1 ~~[c]~~> node #4 with value: letr: a-c, end state? N ev: 0, MAX
node #0 ~~[b]~~> node #5 with value: letr: .-b, end state? N ev: ?, MIN
node #5 ~~[a]~~> node #6 with value: letr: b-a, end state? N ev: 0, MAX
node #5 ~~[b]~~> node #7 with value: letr: b-b, end state? Y ev: Infinity, MAX
node #5 ~~[c]~~> node #8 with value: letr: b-c, end state? N ev: 0, MAX
node #0 ~~[c]~~> node #9 with value: letr: .-c, end state? N ev: ?, MIN
node #9 ~~[a]~~> node #10 with value: letr: c-a, end state? N ev: 0, MAX
node #9 ~~[b]~~> node #11 with value: letr: c-b, end state? N ev: 0, MAX
node #9 ~~[c]~~> node #12 with value: letr: c-c, end state? Y ev: Infinity, MAX


`.trim()                           );                                   
                });

                it('all nodes evaluated', function() {
                    const s: string = moveTreeAllStatesEvaluatedStringified(2);
                assert.strictEqual(s,
`
ROOT node #0 with value: letr: .-., end state? N ev: 0, MAX
node #0 ~~[a]~~> node #1 with value: letr: .-a, end state? N ev: 0, MIN
node #1 ~~[a]~~> node #2 with value: letr: a-a, end state? Y ev: Infinity, MAX
node #1 ~~[b]~~> node #3 with value: letr: a-b, end state? N ev: 0, MAX
node #1 ~~[c]~~> node #4 with value: letr: a-c, end state? N ev: 0, MAX
node #0 ~~[b]~~> node #5 with value: letr: .-b, end state? N ev: 0, MIN
node #5 ~~[a]~~> node #6 with value: letr: b-a, end state? N ev: 0, MAX
node #5 ~~[b]~~> node #7 with value: letr: b-b, end state? Y ev: Infinity, MAX
node #5 ~~[c]~~> node #8 with value: letr: b-c, end state? N ev: 0, MAX
node #0 ~~[c]~~> node #9 with value: letr: .-c, end state? N ev: 0, MIN
node #9 ~~[a]~~> node #10 with value: letr: c-a, end state? N ev: 0, MAX
node #9 ~~[b]~~> node #11 with value: letr: c-b, end state? N ev: 0, MAX
node #9 ~~[c]~~> node #12 with value: letr: c-c, end state? Y ev: Infinity, MAX

`.trim()                           );                                   
                });
                it('minmax', function() {
                    const s: TMinMaxResult<Letter> = minmax(new GameState(null, null)
                                             , GameRules
                                             , evaluator
                                             , 2);
                    assert.strictEqual(s.bestMove, 'a');
                });
                it('minmax-recur', function() {
                    const stats: TMinMaxStatistics = newStatistics();
                    const s: TMinMaxResult<Letter> = minmaxRecur(new GameState(null, null)
                                             , GameRules
                                             , evaluator
                                             , 2
                                             , stats);
                    assert.strictEqual(s.bestMove, 'a');
                    assert.strictEqual(s.evaluation, 0); // (since the game never finishes with perfect play)
                    assert.strictEqual(stats.totalNodesVisited , 1+3+9);
                    assert.strictEqual(stats.leafNodesEvaluated,     9);
                });
            });
            describe('depth 3', function() {
                it('only leaves evaluated', function() {
                    const s: string = moveTreeOnlyEndStatesEvaluatedStringified(3);
                    assert.strictEqual(s,
`
ROOT node #0 with value: letr: .-., end state? N ev: ?, MAX
node #0 ~~[a]~~> node #1 with value: letr: .-a, end state? N ev: ?, MIN
node #1 ~~[a]~~> node #2 with value: letr: a-a, end state? Y ev: Infinity, MAX
node #1 ~~[b]~~> node #3 with value: letr: a-b, end state? N ev: ?, MAX
node #3 ~~[a]~~> node #4 with value: letr: b-a, end state? N ev: 0, MIN
node #3 ~~[b]~~> node #5 with value: letr: b-b, end state? Y ev: -Infinity, MIN
node #3 ~~[c]~~> node #6 with value: letr: b-c, end state? N ev: 0, MIN
node #1 ~~[c]~~> node #7 with value: letr: a-c, end state? N ev: ?, MAX
node #7 ~~[a]~~> node #8 with value: letr: c-a, end state? N ev: 0, MIN
node #7 ~~[b]~~> node #9 with value: letr: c-b, end state? N ev: 0, MIN
node #7 ~~[c]~~> node #10 with value: letr: c-c, end state? Y ev: -Infinity, MIN
node #0 ~~[b]~~> node #11 with value: letr: .-b, end state? N ev: ?, MIN
node #11 ~~[a]~~> node #12 with value: letr: b-a, end state? N ev: ?, MAX
node #12 ~~[a]~~> node #13 with value: letr: a-a, end state? Y ev: -Infinity, MIN
node #12 ~~[b]~~> node #14 with value: letr: a-b, end state? N ev: 0, MIN
node #12 ~~[c]~~> node #15 with value: letr: a-c, end state? N ev: 0, MIN
node #11 ~~[b]~~> node #16 with value: letr: b-b, end state? Y ev: Infinity, MAX
node #11 ~~[c]~~> node #17 with value: letr: b-c, end state? N ev: ?, MAX
node #17 ~~[a]~~> node #18 with value: letr: c-a, end state? N ev: 0, MIN
node #17 ~~[b]~~> node #19 with value: letr: c-b, end state? N ev: 0, MIN
node #17 ~~[c]~~> node #20 with value: letr: c-c, end state? Y ev: -Infinity, MIN
node #0 ~~[c]~~> node #21 with value: letr: .-c, end state? N ev: ?, MIN
node #21 ~~[a]~~> node #22 with value: letr: c-a, end state? N ev: ?, MAX
node #22 ~~[a]~~> node #23 with value: letr: a-a, end state? Y ev: -Infinity, MIN
node #22 ~~[b]~~> node #24 with value: letr: a-b, end state? N ev: 0, MIN
node #22 ~~[c]~~> node #25 with value: letr: a-c, end state? N ev: 0, MIN
node #21 ~~[b]~~> node #26 with value: letr: c-b, end state? N ev: ?, MAX
node #26 ~~[a]~~> node #27 with value: letr: b-a, end state? N ev: 0, MIN
node #26 ~~[b]~~> node #28 with value: letr: b-b, end state? Y ev: -Infinity, MIN
node #26 ~~[c]~~> node #29 with value: letr: b-c, end state? N ev: 0, MIN
node #21 ~~[c]~~> node #30 with value: letr: c-c, end state? Y ev: Infinity, MAX

`.trim()                           );                                   
                });
                it('all nodes evaluated', function() {
                    const s: string = moveTreeAllStatesEvaluatedStringified(3);
                    assert.strictEqual(s,
`
ROOT node #0 with value: letr: .-., end state? N ev: 0, MAX
node #0 ~~[a]~~> node #1 with value: letr: .-a, end state? N ev: 0, MIN
node #1 ~~[a]~~> node #2 with value: letr: a-a, end state? Y ev: Infinity, MAX
node #1 ~~[b]~~> node #3 with value: letr: a-b, end state? N ev: 0, MAX
node #3 ~~[a]~~> node #4 with value: letr: b-a, end state? N ev: 0, MIN
node #3 ~~[b]~~> node #5 with value: letr: b-b, end state? Y ev: -Infinity, MIN
node #3 ~~[c]~~> node #6 with value: letr: b-c, end state? N ev: 0, MIN
node #1 ~~[c]~~> node #7 with value: letr: a-c, end state? N ev: 0, MAX
node #7 ~~[a]~~> node #8 with value: letr: c-a, end state? N ev: 0, MIN
node #7 ~~[b]~~> node #9 with value: letr: c-b, end state? N ev: 0, MIN
node #7 ~~[c]~~> node #10 with value: letr: c-c, end state? Y ev: -Infinity, MIN
node #0 ~~[b]~~> node #11 with value: letr: .-b, end state? N ev: 0, MIN
node #11 ~~[a]~~> node #12 with value: letr: b-a, end state? N ev: 0, MAX
node #12 ~~[a]~~> node #13 with value: letr: a-a, end state? Y ev: -Infinity, MIN
node #12 ~~[b]~~> node #14 with value: letr: a-b, end state? N ev: 0, MIN
node #12 ~~[c]~~> node #15 with value: letr: a-c, end state? N ev: 0, MIN
node #11 ~~[b]~~> node #16 with value: letr: b-b, end state? Y ev: Infinity, MAX
node #11 ~~[c]~~> node #17 with value: letr: b-c, end state? N ev: 0, MAX
node #17 ~~[a]~~> node #18 with value: letr: c-a, end state? N ev: 0, MIN
node #17 ~~[b]~~> node #19 with value: letr: c-b, end state? N ev: 0, MIN
node #17 ~~[c]~~> node #20 with value: letr: c-c, end state? Y ev: -Infinity, MIN
node #0 ~~[c]~~> node #21 with value: letr: .-c, end state? N ev: 0, MIN
node #21 ~~[a]~~> node #22 with value: letr: c-a, end state? N ev: 0, MAX
node #22 ~~[a]~~> node #23 with value: letr: a-a, end state? Y ev: -Infinity, MIN
node #22 ~~[b]~~> node #24 with value: letr: a-b, end state? N ev: 0, MIN
node #22 ~~[c]~~> node #25 with value: letr: a-c, end state? N ev: 0, MIN
node #21 ~~[b]~~> node #26 with value: letr: c-b, end state? N ev: 0, MAX
node #26 ~~[a]~~> node #27 with value: letr: b-a, end state? N ev: 0, MIN
node #26 ~~[b]~~> node #28 with value: letr: b-b, end state? Y ev: -Infinity, MIN
node #26 ~~[c]~~> node #29 with value: letr: b-c, end state? N ev: 0, MIN
node #21 ~~[c]~~> node #30 with value: letr: c-c, end state? Y ev: Infinity, MAX

`.trim()                           );                                   
                });
                it('minmax', function() {
                    const s: TMinMaxResult<Letter> = minmax(new GameState(null, null)
                                                            , GameRules
                                                            , evaluator
                                                            , 2);
                    assert.strictEqual(s.bestMove, 'a');
                });
                it('minmax-recur', function() {
                    const stats: TMinMaxStatistics = newStatistics();                    
                    const s: TMinMaxResult<Letter> = minmaxRecur(new GameState(null, null)
                                             , GameRules
                                             , evaluator
                                             , 3
                                             , stats);
                    assert.strictEqual(s.bestMove, 'a');
                    assert.strictEqual(s.evaluation, 0); // (since the game never finishes with perfect play)
                    const rootNodes            = 1;
                    const ply1Nodes            = 3; 
                    const ply2NodesTerminal    = 3;
                    const ply2NodesNonTerminal = 6;
                    const ply3Nodes            = 18;

                    assert.strictEqual(stats.totalNodesVisited , rootNodes+ply1Nodes+ply2NodesTerminal+ply2NodesNonTerminal+ply3Nodes);
                    assert.strictEqual(stats.leafNodesEvaluated, ply2NodesTerminal + ply3Nodes);
                });                
            });
        });
    });
});

/*
import type {F}  from '../src/trees.js';
import type {F2} from '../src/trees.js';

import type {Exact} from 'flow-common-types';

*/
