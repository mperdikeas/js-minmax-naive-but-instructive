// @flow
'use strict'; 
require('source-map-support').install();
import 'babel-polyfill';
import {assert}  from 'chai';
import AssertionError    from 'assertion-error';
assert.isOk(AssertionError);
import           _ from 'lodash';
assert.isOk(_);
import {Node}            from 'simple-trees';
assert.isOk(Node);
import type {Exact} from 'flow-common-types';

/*
 *
 *    We're going to test various pseudo-games.
 *
 *    MoveGTP         will be the type Move
 *    GameStateGTP    is simply 'number'
 * 
 *
 *
 */

import type {BrancherFT}                       from '../src/index.js';
import type {IGameRules}                       from '../src/index.js';
import type {EvaluatorFT}                      from '../src/index.js';
import type {TMinMaxResult}                    from '../src/index.js';
import      {minmaxRecur}                      from '../src/index.js';


type NodeT = Node<?number, string>;

function brancher(node: NodeT): Array<string> {
    if (node.children!=null)
        return Array.from( node.children.keys() );
    else
        throw new Error('I was provided assurances from the library that the brancher will never be called on a childless node, and yet that came to pass');
}

(brancher: BrancherFT<NodeT, string>)

function nextState(gs: NodeT, move: string): NodeT {
    if (gs.children!=null) {
        const rv: ?NodeT = gs.children.get(move);
        if (rv!=null)
            return rv;
        else throw new Error('bug in my pseudo-game logic');
    } else
        throw new Error('bug in my pseudo-game logic');
}

function isTerminalState(n: NodeT) {
    return n.children===null;
}


const GameRules: IGameRules<NodeT, string> =
          {
              brancher: brancher,
              nextState: nextState,
              isTerminalState: isTerminalState
          };

function evaluator(n: NodeT): number {
    if (n.value!=null)
        return n.value;
    else
        throw new Error('bug in my pseudo-game logic');
}

(evaluator: EvaluatorFT<NodeT>);



function pseudoGameLogic1 (): NodeT {

    const a    = new Node();
    const b    = new Node();
    const c1   = new Node(5);
    const c2   = new Node(4);
    const c3   = new Node(1);
    const c4   = new Node(2);
    const c5   = new Node(3);
    
    a.setn('b' ,  b);
    b.setn('c1', c1);
    b.setn('c2', c2);
    b.setn('c3', c3);
    b.setn('c4', c4);
    b.setn('c5', c5);

    /*   X                     maximizing
         +--b-->X              minimizing
                +--c1-->5
                +--c2-->4
                +--c3-->1
                +--c4-->2
                +--c5-->3
     */

    return a;
}

function pseudoGameLogic2 (): NodeT {

    const a    = new Node();
    const b    = new Node();
    const c    = new Node();
    const b1   = new Node(4);
    const b2   = new Node(4);
    const b3   = new Node(0);
    const c1   = new Node(2);
    const c2   = new Node(1);
    const c3   = new Node(3);
    
    a.setn('b' ,  b);
    a.setn('c' ,  c);    
    b.setn('b1', b1);
    b.setn('b2', b2);
    b.setn('b3', b3);
    c.setn('c1', c1);
    c.setn('c2', c2);
    c.setn('c3', c3);

    /*   X                     maximizing
         +--b-->X              minimizing
         |      +--b1-->4
         |      +--b2-->4
         |      +--b3-->0
         |
         +--c-->X              minimizing
                +--c1-->2
                +--c2-->1
                +--c3-->3

     */    

    return a;
}



describe('recursive minmax on various pseudo games', function() {
    it('game 1', function() {
        [3,4,10,100,1000].forEach(function(ply) {
            const x: TMinMaxResult<string> = minmaxRecur(pseudoGameLogic1()
                                                         , GameRules
                                                         , evaluator
                                                         , ply);
            assert.strictEqual(x.bestMove  , 'b');
            assert.strictEqual(x.evaluation,   1);
        });
    });
    it('game 2', function() {
        [3,4,10,100,1000].forEach(function(ply) {
            const x: TMinMaxResult<string> = minmaxRecur(pseudoGameLogic2()
                                                         , GameRules
                                                         , evaluator
                                                         , ply);
            assert.strictEqual(x.bestMove  , 'c');
            assert.strictEqual(x.evaluation,   1);
        });
    });    
});
