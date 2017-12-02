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



import type {
    IGameRules, EvaluatorFT, MinMaxFT, TMinMaxResult
} from './minmax-interface.js'


class GameTreeNode<GameStateGTP> {

    gameState: GameStateGTP;
    maximizingNode: boolean;
    evaluation: ?number;
        
    
    constructor(gameState: GameStateGTP, maximizingNode: boolean, evaluation: ?number) {
        assert.isTrue(evaluation!==undefined);
        this.gameState      = gameState;
        this.maximizingNode = maximizingNode;
        this.evaluation     = evaluation;
    }

    effectiveEvaluation(): number {
        if (this.evaluation!=null) {
            return this.evaluation*(this.maximizingNode?1:(-1));
        } else
            throw new Error("bad choreography, the implementation should never call this method on a node that hasn't been evaluated yet");
    }
}

function generateMoveTree<GameStateGTP, MoveGTP>
    (    gameState: GameStateGTP
       , gameRules: IGameRules<GameStateGTP, MoveGTP>
       , plies    : number
    )
    : Node<GameTreeNode<GameStateGTP>, MoveGTP> {

        function _generateMoveTree
        (   currentNode: Node<GameTreeNode<GameStateGTP>, MoveGTP>
         ,  pliesRemaining: number  )
        : Node<GameTreeNode<GameStateGTP>, MoveGTP> {
            if (pliesRemaining===0) {
                return currentNode;
            } else {
                const gs: GameStateGTP = currentNode.value.gameState;
                if (gameRules.isTerminalState(gs)) {
                    return currentNode;
                } else {
                    const nextMoves: Array<MoveGTP> = gameRules.brancher(gs);
                    nextMoves.forEach(function(move: MoveGTP) {
                        const nextState: GameStateGTP = gameRules.nextState(currentNode.value.gameState, move);
                        const childNode = new Node(new GameTreeNode(nextState, !currentNode.value.maximizingNode, null));
                        currentNode.setn(move, _generateMoveTree(childNode, pliesRemaining-1));
                    });
                    return currentNode;
                }
            }
        }

        return _generateMoveTree(new Node(new GameTreeNode(gameState, true, null)), plies);
    }
    

function evaluateLeafNodes<GameStateGTP, MoveGTP>
    (   moveTree : Node<GameTreeNode<GameStateGTP>, MoveGTP>
     , evaluator : EvaluatorFT <GameStateGTP>
    ): void
    {
        moveTree.depthFirstTraversal(function(n: Node<GameTreeNode<GameStateGTP>, MoveGTP>) {
            if (n.isLeaf()) {
                const evaluation: number = evaluator(n.value.gameState);
                n.value.evaluation = evaluation;                                  
            }
        }, true , true);
    }


function pullUpNodesEvaluationWithMinmax
    <GameStateGTP, MoveGTP>
    (
        moveTree : Node<GameTreeNode<GameStateGTP>, MoveGTP>
    ): void {
        function allChildrenHaveBeenEvaluated(n: Node<GameTreeNode<GameStateGTP>, MoveGTP>) {
            function predicate(n: Node<GameTreeNode<GameStateGTP>, MoveGTP>): boolean {
                return n.value.evaluation!==null;
            }
            return n.allChildrenSatisfy(predicate);
        }
        moveTree.depthFirstTraversal(function(n: Node<GameTreeNode<GameStateGTP>, MoveGTP>) {
            if (!n.isLeaf()) {
                assert.isTrue(allChildrenHaveBeenEvaluated(n)); // TODO: not in production, only in test
                function reducedChildrenEvaluation(children: Map<MoveGTP, Node<GameTreeNode<GameStateGTP>, MoveGTP>>, f: (number,number)=>number, initial: number): number {
                    return Array.from(children).reduce( (accum: number, [_, v: Node<GameTreeNode<MoveGTP, GameStateGTP>>]) => {
                        const evaluation: ?number = v.value.effectiveEvaluation();
                        if (evaluation!=null)
                            return f(accum, evaluation);
                        else
                            throw new Error('impossible, the children should be evaluated at this point');
                    }, initial);
                }                
                const children: ?Map<MoveGTP, Node<GameTreeNode<GameStateGTP>, MoveGTP>> = n.children;
                if (children!=null) {
                    if (n.value.maximizingNode)
                        n.value.evaluation = reducedChildrenEvaluation(children, Math.max, Number.NEGATIVE_INFINITY);
                    else
                        n.value.evaluation = reducedChildrenEvaluation(children, Math.min, Number.POSITIVE_INFINITY);
                } else {
                    assert.isTrue(children===null); // we can't have undefined children
                    assert.fail(0,1,"impossible, I've already checked that this node is not a leaf");
                }
            }
        }
                                     , true    // including this node, although this isn't strictly necessary
                                     , false); // children first, then parents
    }


function findBestMoveByExaminingTheChildrenOfTheRootOnly
    <MoveGTP, GameStateGTP>
    (root: Node<GameTreeNode<GameStateGTP>, MoveGTP>): TMinMaxResult<MoveGTP> {
        assert.isTrue(root.parent  ===null);
        assert.isTrue(root.children !=null);  // you shouldn't call this method on a childless root !
        const rootEvaluation: ?number = root.value.evaluation;
        if (rootEvaluation!=null) {
            let bestMove: ?MoveGTP = null;
            const BEST_MOVE_FOUND = {};
            if (root.children!=null) {
                try {

                    root.children.forEach( (node: Node<GameTreeNode<GameStateGTP>, MoveGTP>, move: MoveGTP) => {
                        if (node.value.evaluation===rootEvaluation) {
                            bestMove = move; // there may be ties but we simply return the first one we find
                            throw BEST_MOVE_FOUND;
                        }
                    } );
                    throw new Error('impossible to iterate the children without encountering the best move');
                } catch (e) {
                    if (e===BEST_MOVE_FOUND) {
                        if (bestMove!=null)
                            return {bestMove: bestMove, evaluation: rootEvaluation};
                        else
                            throw new Error();
                    }
                    else throw e;
                }
            } else throw new Error("we've already asserted the root has children at the beginning of this method");
        } else throw new Error('root must be evaluated at this point');
    }

function minmax <GameStateGTP, MoveGTP>
    (gameState           : GameStateGTP
     , gameRules         : IGameRules<GameStateGTP, MoveGTP>
     , evaluator         : EvaluatorFT<GameStateGTP>
     , plies             : number
    )
    : TMinMaxResult<MoveGTP> {
        assert.isFalse(gameRules.isTerminalState(gameState), 'minmax called on terminal state');
        assert.isTrue(Number.isInteger(plies) && (plies>=1), `illegal plies for minmax: ${plies}`);
        const moveTree: Node<GameTreeNode<GameStateGTP>, MoveGTP>
                  = generateMoveTree                       (gameState, gameRules, plies);
        
        evaluateLeafNodes                                      (moveTree, evaluator);
        pullUpNodesEvaluationWithMinmax                        (moveTree);
        return findBestMoveByExaminingTheChildrenOfTheRootOnly (moveTree);
     }

(minmax: MinMaxFT<mixed, mixed>)


exports.minmax                          = minmax;
exports.generateMoveTree                = generateMoveTree;
exports.evaluateLeafNodes               = evaluateLeafNodes;
exports.pullUpNodesEvaluationWithMinmax = pullUpNodesEvaluationWithMinmax;
exports.GameTreeNode                    = GameTreeNode;

